// 用 GitHub Contents API 推送文件（github.com 直连不通时的备用方案）
// 用法: $env:GH_TOKEN="<token>"; node scripts/push_api.js <file1> <file2> ...
const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = process.env.GH_REPO || 'Kevin-ai94287/battle-news';
const BRANCH = process.env.GH_BRANCH || 'master';
const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) { console.error('缺少 GH_TOKEN'); process.exit(1); }

function req(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const opts = {
      hostname: 'api.github.com', port: 443, path: apiPath, method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'openclaw-push',
        'Content-Type': 'application/json',
      },
    };
    if (data) opts.headers['Content-Length'] = data.length;
    const r = https.request(opts, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        let j; try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(j);
        else reject(new Error(`${res.statusCode} ${j.message || txt.slice(0, 200)}`));
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function pushFile(rel) {
  const content = fs.readFileSync(rel);
  const b64 = content.toString('base64');
  const apiPath = `/repos/${REPO}/contents/${rel.split(path.sep).join('/')}?ref=${BRANCH}`;
  let sha;
  try {
    const cur = await req('GET', apiPath);
    sha = cur.sha;
  } catch (e) { sha = undefined; }
  const body = { message: `update: ${rel}`, content: b64 };
  if (sha) body.sha = sha;
  await req('PUT', apiPath, body);
  console.log(`PUSHED ${rel}`);
}

(async () => {
  for (const f of process.argv.slice(2)) {
    try { await pushFile(f); }
    catch (e) { console.error(`FAIL ${f}: ${e.message}`); process.exitCode = 1; }
  }
})();
