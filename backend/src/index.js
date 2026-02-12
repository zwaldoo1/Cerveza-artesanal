import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import "dotenv/config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// ---- paths ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../uploads");

console.log("📁 __dirname =", __dirname);
console.log("📁 uploads resolved =", uploadsDir);

// ---- MULTER (uploads) ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safe = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, safe + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Servir archivos subidos
app.use("/uploads", express.static(uploadsDir));

// Endpoint de upload
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibió imagen" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// ---- CONFIG ----
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// ---- helpers ----
function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ---- health ----
app.get("/health", (req, res) => res.json({ ok: true }));

// ---- AUTH ----
// Úsalo una vez. Luego lo puedes borrar o proteger.
app.post("/api/auth/register-admin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email y password requeridos" });

  const passwordHash = await bcrypt.hash(String(password), 10);

  try {
    const user = await prisma.user.create({
      data: { email: String(email).toLowerCase(), passwordHash, role: "ADMIN" },
    });
    res.json({ token: signToken(user) });
  } catch {
    res.status(409).json({ error: "Ese email ya existe" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email y password requeridos" });

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  res.json({ token: signToken(user) });
});

// ---- CATEGORIES ----
app.get("/api/categories", async (req, res) => {
  const items = await prisma.category.findMany({ orderBy: { name: "asc" } });
  res.json(items);
});

app.post("/api/categories", authAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name requerido" });
  const created = await prisma.category.create({ data: { name: String(name) } });
  res.status(201).json(created);
});

// ---- PRODUCTS (public read) ----
app.get("/api/products", async (req, res) => {
  const items = await prisma.product.findMany({
    orderBy: { id: "desc" },
    include: { category: true },
  });
  res.json(items);
});

app.get("/api/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const item = await prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!item) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(item);
});

// ---- PRODUCTS (admin write) ----
app.post("/api/products", authAdmin, async (req, res) => {
  const { name, description, price, stock, imageUrl, categoryId } = req.body;
  if (!name || price == null) return res.status(400).json({ error: "name y price son obligatorios" });

  const created = await prisma.product.create({
    data: {
      name: String(name),
      description: description ? String(description) : null,
      price: Number(price),
      stock: stock == null ? 0 : Number(stock),
      imageUrl: imageUrl ? String(imageUrl) : null,
      categoryId: categoryId == null ? null : Number(categoryId),
    },
  });

  res.status(201).json(created);
});

app.put("/api/products/:id", authAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { name, description, price, stock, imageUrl, categoryId } = req.body;

  try {
    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name == null ? undefined : String(name),
        description: description == null ? undefined : String(description),
        price: price == null ? undefined : Number(price),
        stock: stock == null ? undefined : Number(stock),
        imageUrl: imageUrl == null ? undefined : String(imageUrl),
        categoryId: categoryId == null ? undefined : Number(categoryId),
      },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Producto no encontrado" });
  }
});

app.delete("/api/products/:id", authAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Producto no encontrado" });
  }
});

// ---- ADMIN PANEL (PRO) ----
app.get("/admin", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Admin — Cerveza Artesanal</title>
  <style>
    :root{
      --bg:#070A12;
      --card: rgba(255,255,255,.06);
      --border: rgba(255,255,255,.10);
      --text: #EAF0FF;
      --muted:#97A3BC;
      --shadow: 0 22px 70px rgba(0,0,0,.45);
      --ring: 0 0 0 3px rgba(245,158,11,.22);
      --amber:#f59e0b;
      --orange:#fb923c;
      --green:#22c55e;
      --red:#ef4444;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color:var(--text);
      background:
        radial-gradient(900px 600px at 12% 18%, rgba(245,158,11,.18), transparent 60%),
        radial-gradient(820px 540px at 88% 22%, rgba(96,165,250,.14), transparent 55%),
        radial-gradient(900px 700px at 60% 92%, rgba(168,85,247,.12), transparent 62%),
        var(--bg);
      overflow-x:hidden;
    }
    .wrap{max-width:1200px;margin:0 auto;padding:22px 18px 60px}
    .topbar{
      position: sticky; top: 0; z-index: 10;
      padding: 14px 0;
      backdrop-filter: blur(16px);
      background: linear-gradient(to bottom, rgba(7,10,18,.78), rgba(7,10,18,.25));
      border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .toprow{
      display:flex;gap:14px;align-items:center;justify-content:space-between;
      max-width:1200px;margin:0 auto;padding:0 18px;
    }
    .brand{display:flex;gap:12px;align-items:center}
    .logo{
      width:42px;height:42px;border-radius:14px;
      background: radial-gradient(circle at 30% 30%, rgba(245,158,11,.95), rgba(251,146,60,.55));
      box-shadow: 0 18px 60px rgba(245,158,11,.18);
      border: 1px solid rgba(255,255,255,.12);
    }
    .brand h1{font-size:16px;margin:0}
    .brand p{margin:2px 0 0;color:var(--muted);font-size:12px}
    .pill{
      display:inline-flex;align-items:center;gap:8px;
      padding:9px 12px;border-radius:999px;
      background: rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.10);
      color: var(--muted);font-size:12px;
    }
    .dot{width:8px;height:8px;border-radius:999px;background:rgba(239,68,68,.9)}
    .dot.ok{background:rgba(34,197,94,.9)}
    .grid{display:grid;gap:14px;margin-top:18px;grid-template-columns: 1.25fr .75fr}
    @media (max-width:980px){.grid{grid-template-columns:1fr}}
    .card{
      background: var(--card);
      border:1px solid var(--border);
      border-radius:18px;
      box-shadow: var(--shadow);
      overflow:hidden;
    }
    .card .hd{
      padding:16px 16px 10px;
      border-bottom: 1px solid rgba(255,255,255,.06);
      display:flex;align-items:center;justify-content:space-between;gap:12px;
    }
    .card .hd h2{margin:0;font-size:14px}
    .muted{color:var(--muted);font-size:12px}
    .card .bd{padding:16px}
    .row{display:flex;gap:10px;flex-wrap:wrap}
    .row > *{flex:1}
    input, select, textarea{
      width:100%;
      padding:12px 12px;
      border-radius:14px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.05);
      color: var(--text);
      outline:none;
      transition: .15s;
    }
    textarea{min-height:84px;resize:vertical}
    input:focus, select:focus, textarea:focus{
      border-color: rgba(245,158,11,.55);
      box-shadow: var(--ring);
    }
    .btn{
      display:inline-flex;align-items:center;justify-content:center;
      padding:12px 14px;border-radius:14px;border:0;
      cursor:pointer;font-weight:700;color:#0b0b10;
      background: linear-gradient(90deg, var(--amber), var(--orange));
      transition: transform .12s ease, opacity .12s ease;
      white-space:nowrap;
    }
    .btn:hover{transform: translateY(-1px)}
    .btn:active{transform: translateY(0px);opacity:.92}
    .btn2{
      background: rgba(255,255,255,.08);
      color: var(--text);
      border:1px solid rgba(255,255,255,.12);
    }
    .btn2:hover{background: rgba(255,255,255,.11)}
    .btnDanger{
      background: rgba(239,68,68,.15);
      color: #ffd7d7;
      border:1px solid rgba(239,68,68,.25);
    }
    .btnDanger:hover{background: rgba(239,68,68,.22)}
    .stats{display:grid;gap:12px;grid-template-columns: repeat(3, 1fr)}
    @media (max-width:720px){.stats{grid-template-columns:1fr}}
    .stat{
      padding:14px;border-radius:16px;
      background: rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.08);
    }
    .stat .k{color:var(--muted);font-size:12px}
    .stat .v{font-size:22px;font-weight:800;margin-top:6px}
    .stat .b{font-size:12px;color:var(--muted);margin-top:4px}
    .toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
    .toolbar .grow{flex:1}
    .check{
      display:flex;align-items:center;gap:10px;
      padding:10px 12px;border-radius:14px;
      background: rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.10);
      color: var(--muted);font-size:12px;
    }
    .check input{width:18px;height:18px}
    table{
      width:100%;
      border-collapse:separate;
      border-spacing:0;
      overflow:hidden;
      border-radius:16px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.03);
    }
    th, td{padding:12px 12px; text-align:left}
    th{
      font-size:12px;color: var(--muted);
      background: rgba(255,255,255,.06);
      border-bottom: 1px solid rgba(255,255,255,.08);
      position: sticky; top: 72px;
      backdrop-filter: blur(14px);
      z-index: 5;
    }
    tr td{border-bottom: 1px solid rgba(255,255,255,.06);vertical-align: top}
    tr:last-child td{border-bottom:0}
    tr:hover td{background: rgba(255,255,255,.04)}
    .badge{
      display:inline-flex;align-items:center;gap:8px;
      padding:6px 10px;border-radius:999px;
      font-size:12px;border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.05);
      color: var(--muted);
    }
    .badge.ok{color:#c6ffd8;border-color:rgba(34,197,94,.22); background: rgba(34,197,94,.10)}
    .badge.low{color:#ffe9c6;border-color:rgba(245,158,11,.22); background: rgba(245,158,11,.10)}
    .badge.zero{color:#ffd0d0;border-color:rgba(239,68,68,.22); background: rgba(239,68,68,.10)}
    .nameCell{display:flex;flex-direction:column;gap:4px}
    .nameCell strong{font-size:14px}
    .nameCell small{color:var(--muted);font-size:12px;line-height:1.25}
    .actions{display:flex;gap:8px;flex-wrap:wrap}
    .mini{font-size:12px;color:var(--muted)}
    .split{display:grid;grid-template-columns: 1.35fr .65fr; gap:12px;align-items:start}
    @media (max-width:720px){.split{grid-template-columns:1fr}}
    .preview{
      border-radius:16px;
      border:1px dashed rgba(255,255,255,.18);
      background: rgba(255,255,255,.03);
      overflow:hidden;
      aspect-ratio: 1 / 1;
      display:flex;align-items:center;justify-content:center;
      position:relative;
    }
    .preview img{width:100%;height:100%;object-fit:cover;display:none}
    .preview .ph{color: var(--muted);text-align:center;padding:16px;font-size:12px;line-height:1.4}
    .tag{
      position:absolute;left:10px;top:10px;
      padding:6px 10px;border-radius:999px;
      background: rgba(0,0,0,.35);
      border: 1px solid rgba(255,255,255,.12);
      font-size:12px;color:#fff;
      backdrop-filter: blur(10px);
      display:none;
    }
    .toast{
      position: fixed; right: 16px; bottom: 16px;
      display:flex; flex-direction:column; gap:10px; z-index: 999;
    }
    .toast .t{
      background: rgba(0,0,0,.55);
      border: 1px solid rgba(255,255,255,.12);
      color: var(--text);
      padding: 12px 14px;
      border-radius: 14px;
      backdrop-filter: blur(16px);
      box-shadow: 0 18px 50px rgba(0,0,0,.55);
      min-width: 280px;
    }
    .t .h{font-weight:800;font-size:13px}
    .t .p{color:var(--muted);font-size:12px;margin-top:4px}
  </style>
</head>
<body>
  <div class="topbar">
    <div class="toprow">
      <div class="brand">
        <div class="logo"></div>
        <div>
          <h1>Admin — Cerveza Artesanal</h1>
          <p>Productos, categorías e imágenes (MySQL + Prisma)</p>
        </div>
      </div>
      <div class="pill" id="connPill">
        <span class="dot" id="connDot"></span>
        <span id="connText">Conectando…</span>
      </div>
    </div>
  </div>

  <div class="wrap">
    <div class="grid">
      <!-- LEFT -->
      <div class="card">
        <div class="hd">
          <h2>Inventario</h2>
          <span class="muted">Busca, filtra y edita rápido</span>
        </div>
        <div class="bd">
          <div class="stats" style="margin-bottom:14px">
            <div class="stat">
              <div class="k">Productos</div>
              <div class="v" id="sProducts">—</div>
              <div class="b">Total en catálogo</div>
            </div>
            <div class="stat">
              <div class="k">Stock total</div>
              <div class="v" id="sStock">—</div>
              <div class="b">Unidades disponibles</div>
            </div>
            <div class="stat">
              <div class="k">Stock bajo</div>
              <div class="v" id="sLow">—</div>
              <div class="b">≤ 5 unidades</div>
            </div>
          </div>

          <div class="toolbar">
            <input class="grow" id="q" placeholder="Buscar por nombre o ID…" />
            <label class="check">
              <input type="checkbox" id="onlyLow" />
              Ver solo stock bajo
            </label>
            <button class="btn2" onclick="loadAll()">Refrescar</button>
          </div>

          <div style="overflow:auto;border-radius:16px">
            <table>
              <thead>
                <tr>
                  <th style="width:90px">ID</th>
                  <th>Producto</th>
                  <th style="width:120px">Precio</th>
                  <th style="width:120px">Stock</th>
                  <th style="width:160px">Categoría</th>
                  <th style="width:220px">Acciones</th>
                </tr>
              </thead>
              <tbody id="tbody"></tbody>
            </table>
          </div>

          <div class="mini" style="margin-top:10px">
            Tip: usa “Editar” para traer el producto al formulario y actualizarlo.
          </div>
        </div>
      </div>

      <!-- RIGHT -->
      <div>
        <div class="card">
          <div class="hd">
            <h2>Login</h2>
            <span class="muted" id="loginMsg">Ingresa con tu admin</span>
          </div>
          <div class="bd">
            <div class="row">
              <input id="email" placeholder="admin@local.cl" />
              <input id="password" placeholder="Password" type="password" />
            </div>
            <div class="row" style="margin-top:10px">
              <button class="btn" onclick="login()">Entrar</button>
              <button class="btn2" onclick="logout()">Salir</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="hd">
            <h2>Categorías</h2>
            <span class="muted" id="catMsg">Crea categorías para ordenar</span>
          </div>
          <div class="bd">
            <div class="row">
              <input id="catName" placeholder="Ej: IPA, Stout, Vasos…" />
              <button class="btn" onclick="createCategory()">Crear</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="hd">
            <h2>Producto</h2>
            <span class="muted" id="saveMsg">Crea o edita un producto</span>
          </div>
          <div class="bd">
            <div class="split">
              <div>
                <div class="row"><input id="pid" placeholder="ID (vacío para crear)" /></div>
                <div class="row"><input id="name" placeholder="Nombre" /></div>
                <div class="row">
                  <input id="price" placeholder="Precio (int)" />
                  <input id="stock" placeholder="Stock (int)" />
                </div>
                <div class="row">
                  <select id="categoryId"><option value="">(Sin categoría)</option></select>
                </div>
                <div class="row"><input id="imageUrl" placeholder="imageUrl (se completa al subir)" /></div>
                <div class="row">
                  <input id="imageFile" type="file" accept="image/*" />
                  <button class="btn2" onclick="uploadImage()">Subir imagen</button>
                </div>
                <div class="row"><textarea id="description" placeholder="Descripción (opcional)"></textarea></div>
                <div class="row" style="margin-top:10px">
                  <button class="btn" onclick="save()">Guardar</button>
                  <button class="btn2" onclick="clearForm()">Limpiar</button>
                </div>
              </div>

              <div>
                <div class="preview">
                  <span class="tag" id="pvTag">Preview</span>
                  <img id="pvImg" alt="preview"/>
                  <div class="ph" id="pvPh">
                    Selecciona una imagen o sube una para ver el preview.
                    <br/><br/>Se guardará como <b>/uploads/...</b>
                  </div>
                </div>
                <div class="mini" style="margin-top:10px">
                  Si ya tienes una URL, pégala en <b>imageUrl</b> y guarda.
                </div>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /RIGHT -->
    </div><!-- /grid -->
  </div><!-- /wrap -->

  <div class="toast" id="toasts"></div>

<script>
  let TOKEN = localStorage.getItem("admin_token") || "";
  let ALL_PRODUCTS = [];
  const API_BASE = "http://localhost:4000";

  function toast(title, msg){
    const el = document.createElement("div");
    el.className = "t";
    el.innerHTML = '<div class="h">'+title+'</div><div class="p">'+msg+'</div>';
    document.getElementById("toasts").appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(6px)"; }, 2600);
    setTimeout(()=>{ el.remove(); }, 3100);
  }

  function setConn(ok){
    const dot = document.getElementById("connDot");
    const text = document.getElementById("connText");
    dot.className = "dot" + (ok ? " ok" : "");
    text.textContent = ok ? "API OK" : "API OFF";
  }

  function headers() {
    return TOKEN ? { "Authorization": "Bearer " + TOKEN } : {};
  }

  async function ping(){
    try{
      const r = await fetch("/health");
      setConn(r.ok);
    }catch{
      setConn(false);
    }
  }

  async function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const r = await fetch("/api/auth/login", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json().catch(()=>null);
    if (!r.ok) {
      document.getElementById("loginMsg").textContent = (data && data.error) ? data.error : "Error login";
      toast("Login", document.getElementById("loginMsg").textContent);
      return;
    }
    TOKEN = data.token;
    localStorage.setItem("admin_token", TOKEN);
    document.getElementById("loginMsg").textContent = "✅ Login OK";
    toast("Login OK", "Sesión iniciada.");
    loadAll();
  }

  function logout(){
    TOKEN = "";
    localStorage.removeItem("admin_token");
    document.getElementById("loginMsg").textContent = "Sesión cerrada";
    toast("Logout", "Se cerró la sesión.");
  }

  function setPreview(url){
    const img = document.getElementById("pvImg");
    const ph = document.getElementById("pvPh");
    const tag = document.getElementById("pvTag");
    if(!url){
      img.style.display="none";
      ph.style.display="block";
      tag.style.display="none";
      img.src="";
      return;
    }
    img.src = url;
    img.style.display="block";
    ph.style.display="none";
    tag.style.display="inline-flex";
  }

  function clearForm() {
    ["pid","name","price","stock","imageUrl","description"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("categoryId").value = "";
    const f = document.getElementById("imageFile");
    if (f) f.value = "";
    setPreview(null);
    document.getElementById("saveMsg").textContent = "Crea o edita un producto";
  }

  function fillForm(p) {
    document.getElementById("pid").value = p.id;
    document.getElementById("name").value = p.name || "";
    document.getElementById("price").value = p.price ?? "";
    document.getElementById("stock").value = p.stock ?? "";
    document.getElementById("imageUrl").value = p.imageUrl || "";
    document.getElementById("description").value = p.description || "";
    document.getElementById("categoryId").value = (p.categoryId ?? "");
    if (p.imageUrl){
      const abs = String(p.imageUrl).startsWith("http") ? p.imageUrl : (API_BASE + p.imageUrl);
      setPreview(abs);
    } else {
      setPreview(null);
    }
    document.getElementById("saveMsg").textContent = "Editando producto #" + p.id;
    toast("Editar", "Producto cargado en el formulario.");
  }

  async function uploadImage() {
    const fileInput = document.getElementById("imageFile");
    const file = fileInput.files && fileInput.files[0];
    if (!file) { toast("Imagen", "Selecciona una imagen primero."); return; }

    // preview local inmediato
    setPreview(URL.createObjectURL(file));

    const form = new FormData();
    form.append("image", file);

    const r = await fetch("/api/upload", { method: "POST", body: form });
    const data = await r.json().catch(() => null);

    if (!r.ok) { toast("Error upload", (data && data.error) ? data.error : "Error subiendo imagen"); return; }

    document.getElementById("imageUrl").value = data.url;
    setPreview(API_BASE + data.url);
    toast("Imagen subida", data.url);
  }

  async function createCategory() {
    const name = document.getElementById("catName").value.trim();
    if (!name) return;
    const r = await fetch("/api/categories", {
      method:"POST",
      headers:{ "Content-Type":"application/json", ...headers() },
      body: JSON.stringify({ name })
    });
    const data = await r.json().catch(()=>null);
    document.getElementById("catMsg").textContent = r.ok ? "✅ Creada" : ((data&&data.error)||"Error");
    toast("Categorías", document.getElementById("catMsg").textContent);
    document.getElementById("catName").value = "";
    loadCategories();
  }

  async function loadCategories() {
    const r = await fetch("/api/categories");
    const cats = await r.json();
    const sel = document.getElementById("categoryId");
    sel.innerHTML = '<option value="">(Sin categoría)</option>' +
      cats.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join("");
  }

  async function save() {
    const id = document.getElementById("pid").value.trim();
    const payload = {
      name: document.getElementById("name").value.trim(),
      price: Number(document.getElementById("price").value),
      stock: Number(document.getElementById("stock").value || 0),
      imageUrl: document.getElementById("imageUrl").value.trim() || null,
      description: document.getElementById("description").value.trim() || null,
      categoryId: document.getElementById("categoryId").value ? Number(document.getElementById("categoryId").value) : null
    };

    if (!payload.name || Number.isNaN(payload.price)) {
      toast("Validación", "Nombre y precio son obligatorios (precio numérico).");
      return;
    }

    const url = id ? "/api/products/" + id : "/api/products";
    const method = id ? "PUT" : "POST";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type":"application/json", ...headers() },
      body: JSON.stringify(payload)
    });

    const data = r.status === 204 ? null : await r.json().catch(()=>null);

    if (!r.ok) {
      const msg = (data && data.error) ? data.error : "Error guardando";
      document.getElementById("saveMsg").textContent = msg;
      toast("Error", msg);
      return;
    }

    document.getElementById("saveMsg").textContent = "✅ Guardado";
    toast("Guardado", "Producto guardado correctamente.");
    clearForm();
    loadProducts();
  }

  async function delProduct(id) {
    if (!confirm("¿Eliminar producto " + id + "?")) return;
    const r = await fetch("/api/products/" + id, { method:"DELETE", headers: headers() });
    if (!r.ok) toast("Error", "No se pudo eliminar.");
    else toast("Eliminado", "Producto eliminado.");
    loadProducts();
  }

  function moneyCLP(n){
    try { return Number(n).toLocaleString("es-CL"); } catch { return String(n); }
  }

  function stockBadge(stock){
    stock = Number(stock)||0;
    if (stock === 0) return '<span class="badge zero">0 • Sin stock</span>';
    if (stock <= 5) return '<span class="badge low">' + stock + ' • Bajo</span>';
    return '<span class="badge ok">' + stock + ' • OK</span>';
  }

  function renderProducts(list){
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = list.map(p => {
      const cat = p.category ? p.category.name : "-";
      const desc = (p.description || "").trim();
      const short = desc.length > 72 ? (desc.slice(0,72) + "…") : desc;

      return \`
        <tr>
          <td>\${p.id}</td>
          <td>
            <div class="nameCell">
              <strong>\${p.name}</strong>
              <small>\${short || "Sin descripción"}</small>
            </div>
          </td>
          <td>$\${moneyCLP(p.price)}</td>
          <td>\${stockBadge(p.stock)}</td>
          <td><span class="badge">\${cat}</span></td>
          <td>
            <div class="actions">
              <button class="btn2" onclick='fillForm(\${JSON.stringify(p).replace(/'/g,"&#39;")})'>Editar</button>
              <button class="btnDanger" onclick='delProduct(\${p.id})'>Eliminar</button>
            </div>
          </td>
        </tr>\`;
    }).join("");

    const total = list.length;
    const stockSum = list.reduce((a,p)=> a + (Number(p.stock)||0), 0);
    const low = list.filter(p => (Number(p.stock)||0) <= 5).length;

    document.getElementById("sProducts").textContent = total;
    document.getElementById("sStock").textContent = stockSum;
    document.getElementById("sLow").textContent = low;
  }

  function applyFilters(){
    const q = (document.getElementById("q").value || "").toLowerCase().trim();
    const onlyLow = document.getElementById("onlyLow").checked;
    let list = ALL_PRODUCTS.slice();

    if (q){
      list = list.filter(p =>
        String(p.id).includes(q) ||
        String(p.name||"").toLowerCase().includes(q)
      );
    }
    if (onlyLow){
      list = list.filter(p => (Number(p.stock)||0) <= 5);
    }
    renderProducts(list);
  }

  async function loadProducts() {
    const r = await fetch("/api/products");
    const items = await r.json();
    ALL_PRODUCTS = Array.isArray(items) ? items : [];
    applyFilters();
  }

  async function loadAll() {
    await ping();
    await loadCategories();
    await loadProducts();
  }

  document.getElementById("q").addEventListener("input", applyFilters);
  document.getElementById("onlyLow").addEventListener("change", applyFilters);

  document.getElementById("imageUrl").addEventListener("input", (e)=>{
    const v = (e.target.value||"").trim();
    if (!v) return setPreview(null);
    const abs = v.startsWith("http") ? v : (API_BASE + v);
    setPreview(abs);
  });

  loadAll();
  setInterval(ping, 5000);
</script>
</body>
</html>`);
});

// ---- start ----
app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
