import * as fs from 'node:fs';
import * as stream from 'node:stream';
import * as util from 'node:util';
import got, * as Got from 'got';
import IPCIDR from 'ip-cidr';
import PrivateIp from 'private-ip';
import { StatusError } from './status-error.js';
import { getAgents } from './http.js';
import { parse } from 'content-disposition';
const pipeline = util.promisify(stream.pipeline);
export const defaultDownloadConfig = {
    userAgent: `MisskeyMediaProxy/0.0.0`,
    allowedPrivateNetworks: [],
    maxSize: 262144000,
    proxy: false,
    ...getAgents()
};
export async function downloadUrl(url, path, settings = defaultDownloadConfig) {
    if (process.env.NODE_ENV !== 'production')
        console.log(`Downloading ${url} to ${path} ...`);
    const timeout = 30 * 1000;
    const operationTimeout = 60 * 1000;
    const urlObj = new URL(url);
    let filename = urlObj.pathname.split('/').pop() ?? 'unknown';
    const req = got.stream(url, {
        headers: {
            'User-Agent': settings.userAgent,
        },
        timeout: {
            lookup: timeout,
            connect: timeout,
            secureConnect: timeout,
            socket: timeout,
            response: timeout,
            send: timeout,
            request: operationTimeout, // whole operation timeout
        },
        agent: {
            http: settings.httpAgent,
            https: settings.httpsAgent,
        },
        http2: true,
        retry: {
            limit: 0,
        },
        enableUnixSockets: false,
    }).on('response', (res) => {
        if ((process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') && !settings.proxy && res.ip) {
            if (isPrivateIp(res.ip, settings.allowedPrivateNetworks)) {
                console.log(`Blocked address: ${res.ip}`);
                req.destroy();
            }
        }
        const contentLength = res.headers['content-length'];
        if (contentLength != null) {
            const size = Number(contentLength);
            if (size > settings.maxSize) {
                console.log(`maxSize exceeded (${size} > ${settings.maxSize}) on response`);
                req.destroy();
            }
        }
        const contentDisposition = res.headers['content-disposition'];
        if (contentDisposition != null) {
            try {
                const parsed = parse(contentDisposition);
                if (parsed.parameters.filename) {
                    filename = parsed.parameters.filename;
                }
            }
            catch (e) {
                console.log(`Failed to parse content-disposition: ${contentDisposition}\n${e}`);
            }
        }
    }).on('downloadProgress', (progress) => {
        if (progress.transferred > settings.maxSize) {
            console.log(`maxSize exceeded (${progress.transferred} > ${settings.maxSize}) on downloadProgress`);
            req.destroy();
        }
    });
    try {
        await pipeline(req, fs.createWriteStream(path));
    }
    catch (e) {
        if (e instanceof Got.HTTPError) {
            throw new StatusError(`${e.response.statusCode} ${e.response.statusMessage}`, e.response.statusCode, e.response.statusMessage);
        }
        else {
            throw e;
        }
    }
    if (process.env.NODE_ENV !== 'production')
        console.log(`Download finished: ${url}`);
    return {
        filename,
    };
}
function isPrivateIp(ip, allowedPrivateNetworks) {
    for (const net of allowedPrivateNetworks ?? []) {
        const cidr = new IPCIDR(net);
        if (cidr.contains(ip)) {
            return false;
        }
    }
    return PrivateIp(ip) ?? false;
}
