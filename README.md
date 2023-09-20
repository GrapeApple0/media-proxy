# Media Proxy for Misskey

[→ メディアプロキシの仕様](./SPECIFICATION.md)

Misskeyの/proxyが単体で動作します（Misskeyのコードがほぼそのまま移植されています）。

**Fastifyプラグインとして動作する気がします。**  
`pnpm start`は[fastify-cli](https://github.com/fastify/fastify-cli)が動作します。

一応AWS Lambdaで動かす実装を用意しましたが、全くおすすめしません。
https://github.com/tamaina/media-proxy-lambda

Sharp.jsを使っているため、メモリアロケータにjemallocを指定することをお勧めします。

## Fastifyプラグインとして動作させる
### npm install

```
npm install git+https://github.com/misskey-dev/media-proxy.git
```

### Fastifyプラグインを書く
```
import MediaProxy from 'misskey-media-proxy';

// ......

fastify.register(MediaProxy);
```

オプションを指定できます。オプションの内容はindex.tsのMediaProxyOptionsに指定してあります。

## サーバーのセットアップ方法
まずはgit cloneしてcdしてください。

```
git clone https://github.com/misskey-dev/media-proxy.git
cd media-proxy
```

### jemallocをインストール
Debian/Ubuntuのaptの場合

```
sudo apt install libjemalloc2
```

### pnpm install
```
NODE_ENV=production pnpm install
```

### config.jsを追加

次のような内容で、設定ファイルconfig.jsをルートに作成してください。

```js
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
```

### サーバーを立てる
適当にサーバーを公開してください。  
（ここではmediaproxy.example.comで公開するものとします。）

メモ書き程度にsystemdでの開始方法を残します。  
（サーバーレスだとsharp.jsが動かない可能性が高いため、そこはなんとかしてください）

systemdサービスのファイルを作成…

/etc/systemd/system/misskey-proxy.service

エディタで開き、以下のコードを貼り付けて保存

ユーザーやポートは適宜変更すること。  
また、arm64の場合`Environment="LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2"`のx86_64をaarch64に変更する必要がある。jemallocのパスはディストリビューションによって変わる可能性がある。

```systemd
[Unit]
Description=Misskey Media Proxy

[Service]
Type=simple
User=misskey
ExecStart=/usr/bin/npm start
WorkingDirectory=/home/misskey/media-proxy
Environment="LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2"
Environment="NODE_ENV=production"
Environment="PORT=3000"
TimeoutSec=60
StandardOutput=journal
StandardError=journal
SyslogIdentifier=media-proxy
Restart=always

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl daemon-reload
sudo systemctl enable misskey-proxy
sudo systemctl start misskey-proxy
```

3000ポートまでnginxなどでルーティングしてやります。

### Misskeyのdefault.ymlに追記

mediaProxyの指定をdefault.ymlに追記し、Misskeyを再起動してください。

```yml
mediaProxy: https://mediaproxy.example.com
```

