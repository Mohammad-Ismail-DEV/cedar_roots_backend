const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const sharp = require("sharp");

jest.mock("../src/models", () => ({}));

const env = require("../src/config/env");

let root;
let original;
let app;

const binary = (res, done) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => done(null, Buffer.concat(chunks)));
};

const widthOf = async (res) => (await sharp(res.body).metadata()).width;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cedar-img-"));
  env.uploadsDir = path.join(root, "uploads");
  fs.mkdirSync(env.uploadsDir);

  // A 3000x2000 photo is the "full resolution" original.
  original = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: { r: 120, g: 160, b: 90 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
  fs.writeFileSync(path.join(env.uploadsDir, "photo.jpg"), original);
  fs.writeFileSync(
    path.join(env.uploadsDir, "small.png"),
    await sharp({ create: { width: 300, height: 200, channels: 3, background: "#fff" } })
      .png()
      .toBuffer()
  );
  fs.writeFileSync(path.join(env.uploadsDir, "anim.gif"), "GIF89a-not-really");

  app = require("../src/app");
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const get = (url) => request(app).get(url).buffer(true).parse(binary);

test("without ?w= the original is served untouched, and cacheable forever", async () => {
  const res = await get("/uploads/photo.jpg");

  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toMatch(/jpeg/);
  expect(Buffer.compare(res.body, original)).toBe(0);
  expect(res.headers["cache-control"]).toMatch(/max-age=31536000/);
});

test("?w= serves a much smaller WebP at the next size up, keeping the shape", async () => {
  const res = await get("/uploads/photo.jpg?w=1000");

  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toMatch(/webp/);
  expect(res.headers["cache-control"]).toMatch(/immutable/);
  expect(await widthOf(res)).toBe(1080);
  expect((await sharp(res.body).metadata()).height).toBe(720); // 3:2 stays 3:2
  expect(res.body.length).toBeLessThan(original.length / 4);
});

test("asking for more than the largest size is capped at 1600", async () => {
  const res = await get("/uploads/photo.jpg?w=99999");

  expect(await widthOf(res)).toBe(1600);
});

test("small photos are never enlarged", async () => {
  const res = await get("/uploads/small.png?w=1080");

  expect(await widthOf(res)).toBe(300);
});

test("the variant is generated once and then reused from disk", async () => {
  await get("/uploads/photo.jpg?w=512");
  const file = path.join(root, "image-cache", "512", "photo.jpg.webp");
  const firstBuilt = fs.statSync(file).mtimeMs;

  await get("/uploads/photo.jpg?w=400");

  expect(fs.statSync(file).mtimeMs).toBe(firstBuilt);
});

test("ten simultaneous first requests still produce one good file", async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, () => get("/uploads/photo.jpg?w=256"))
  );

  results.forEach((r) => expect(r.status).toBe(200));
  expect(await widthOf(results[0])).toBe(256);
});

test("things that are not resizable fall back to the original file", async () => {
  const gif = await get("/uploads/anim.gif?w=256");
  expect(gif.status).toBe(200);
  expect(gif.body.toString()).toBe("GIF89a-not-really");

  expect((await get("/uploads/missing.jpg?w=256")).status).toBe(404);
});

test("junk or malicious width and path values cannot escape the uploads folder", async () => {
  expect((await get("/uploads/photo.jpg?w=abc")).headers["content-type"]).toMatch(/jpeg/);
  expect((await get("/uploads/photo.jpg?w=-5")).headers["content-type"]).toMatch(/jpeg/);

  const traversal = await get("/uploads/..%2f..%2fpackage.json?w=256");
  expect(traversal.status).toBe(404);
});
