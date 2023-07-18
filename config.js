import { readFileSync } from 'node:fs';

const repo = JSON.parse(readFileSync('./package.json', 'utf8'));

export default {
    // UA
    userAgent: `MisskeyMediaProxy/${repo.version}`,

    // プライベートネットワークでも許可するIP CIDR（default.ymlと同じ）
    allowedPrivateNetworks: [],

    // ダウンロードするファイルの最大サイズ (bytes)
    maxSize: 262144000,

    // CORS
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',

    // CSP
    'Content-Security-Policy': `default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'`,

    // フォワードプロキシ
    // proxy: 'http://127.0.0.1:3128'
}
