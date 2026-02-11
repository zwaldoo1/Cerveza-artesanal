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

// ---- ADMIN PANEL (simple) ----
app.get("/admin", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Admin - Cerveza Artesanal</title>
  <style>
    body{font-family:system-ui,Segoe UI,Arial;max-width:1000px;margin:24px auto;padding:0 16px}
    .card{border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0}
    input,button,select{padding:10px;border-radius:10px;border:1px solid #ccc}
    button{cursor:pointer}
    .row{display:flex;gap:10px;flex-wrap:wrap}
    .row > *{flex:1}
    table{width:100%;border-collapse:collapse}
    th,td{border-bottom:1px solid #eee;padding:10px;text-align:left}
    .muted{color:#666;font-size:12px}
  </style>
</head>
<body>
  <h2>Panel Admin</h2>
  <p class="muted">Login + categorías + productos (MySQL + Prisma)</p>

  <div class="card">
    <h3>1) Login</h3>
    <div class="row">
      <input id="email" placeholder="admin@local.cl"/>
      <input id="password" placeholder="Password" type="password"/>
      <button onclick="login()">Entrar</button>
    </div>
    <p class="muted" id="loginMsg"></p>
  </div>

  <div class="card">
    <h3>2) Categorías</h3>
    <div class="row">
      <input id="catName" placeholder="Nueva categoría (ej: IPA)"/>
      <button onclick="createCategory()">Crear</button>
    </div>
    <p class="muted" id="catMsg"></p>
  </div>

  <div class="card">
    <h3>3) Crear / editar producto</h3>
    <div class="row">
      <input id="pid" placeholder="ID (vacío para crear)"/>
      <input id="name" placeholder="Nombre"/>
      <input id="price" placeholder="Precio (int)"/>
      <input id="stock" placeholder="Stock (int)"/>
    </div>
    <div class="row">
      <select id="categoryId">
        <option value="">(Sin categoría)</option>
      </select>
      <input id="imageUrl" placeholder="Image URL (opcional)"/>
      <input id="description" placeholder="Descripción (opcional)"/>
      <button onclick="save()">Guardar</button>
    </div>
    <p class="muted" id="saveMsg"></p>
  </div>

  <div class="card">
    <h3>4) Productos</h3>
    <button onclick="loadAll()">Refrescar</button>
    <table>
      <thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Categoría</th><th>Acciones</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>

<script>
  let TOKEN = localStorage.getItem("admin_token") || "";

  function headers() {
    return TOKEN ? { "Authorization": "Bearer " + TOKEN } : {};
  }

  async function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const r = await fetch("/api/auth/login", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) {
      document.getElementById("loginMsg").textContent = data.error || "Error login";
      return;
    }
    TOKEN = data.token;
    localStorage.setItem("admin_token", TOKEN);
    document.getElementById("loginMsg").textContent = "✅ Login OK";
    loadAll();
  }

  function clearForm() {
    ["pid","name","price","stock","imageUrl","description"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("categoryId").value = "";
  }

  function fillForm(p) {
    document.getElementById("pid").value = p.id;
    document.getElementById("name").value = p.name || "";
    document.getElementById("price").value = p.price ?? "";
    document.getElementById("stock").value = p.stock ?? "";
    document.getElementById("imageUrl").value = p.imageUrl || "";
    document.getElementById("description").value = p.description || "";
    document.getElementById("categoryId").value = p.categoryId ?? "";
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
    document.getElementById("catName").value = "";
    loadCategories();
  }

  async function loadCategories() {
    const r = await fetch("/api/categories");
    const cats = await r.json();
    const sel = document.getElementById("categoryId");
    sel.innerHTML = '<option value="">(Sin categoría)</option>' + cats.map(c => \`<option value="\${c.id}">\${c.name}</option>\`).join("");
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

    const url = id ? "/api/products/" + id : "/api/products";
    const method = id ? "PUT" : "POST";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type":"application/json", ...headers() },
      body: JSON.stringify(payload)
    });

    const data = r.status === 204 ? null : await r.json().catch(()=>null);

    if (!r.ok) {
      document.getElementById("saveMsg").textContent = (data && data.error) ? data.error : "Error guardando";
      return;
    }

    document.getElementById("saveMsg").textContent = "✅ Guardado";
    clearForm();
    loadProducts();
  }

  async function delProduct(id) {
    if (!confirm("¿Eliminar producto " + id + "?")) return;
    const r = await fetch("/api/products/" + id, {
      method:"DELETE",
      headers: headers()
    });
    if (!r.ok) alert("Error eliminando");
    loadProducts();
  }

  async function loadProducts() {
    const r = await fetch("/api/products");
    const items = await r.json();
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = items.map(p => \`
      <tr>
        <td>\${p.id}</td>
        <td>\${p.name}</td>
        <td>\${p.price}</td>
        <td>\${p.stock}</td>
        <td>\${p.category ? p.category.name : "-"}</td>
        <td>
          <button onclick='fillForm(\${JSON.stringify(p).replace(/'/g,"&#39;")})'>Editar</button>
          <button onclick='delProduct(\${p.id})'>Eliminar</button>
        </td>
      </tr>\`
    ).join("");
  }

  async function loadAll() {
    await loadCategories();
    await loadProducts();
  }

  loadAll();
</script>
</body>
</html>`);
});

app.listen(PORT, () => console.log(`API corriendo en http://localhost:${PORT}`));
