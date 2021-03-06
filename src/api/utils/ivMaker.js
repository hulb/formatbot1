const fetch = require('node-fetch');
const makeTelegaph = require('./makeTelegaph');
const logger = require('./logger');
const ParseHelper = require('./parseHelper');
const db = require('./db');

function from64(v) {
  return Buffer.from(v, 'base64');
}

const G = from64('bmV3cy5nb29nbGUuY29t');

const makeIvLinkFromContent = async (file, paramsObj) => {
  const { access_token, ...params } = paramsObj;
  const authorUrl = `from File`;
  const parseHelper = new ParseHelper('', params);
  let content = file.content;
  let title = file.file_name;
  if (file.isHtml) {
    content = await parseHelper.parseContent(content);
  } else {
    content = `<div>${content}</div>`;
  }
  if (!content) throw 'empty content';
  const obj = { title, access_token, authorUrl };
  const tgRes = await makeTelegaph(obj, content);
  const { telegraphLink, isLong, pages, push } = tgRes;
  if (!telegraphLink) throw 'empty ivlink';
  const res = { iv: telegraphLink, pages, push, title };
  res.isLong = res.pages;
  return res;
};

const makeIvLink = async (url, paramsObj) => {
  if (paramsObj.db) {
    const exist = await db.get(url);
    if (exist) {
      logger('from db');
      exist.isLong = exist.pages;
      return exist;
    }
  }

  url = toUrl(url);
  const { access_token, ...params } = paramsObj;
  const authorUrl = `${url}`;
  const parseHelper = new ParseHelper(url, params);
  const { title, content } = await parseHelper.parse();
  if (!content) throw 'empty content';
  const obj = { title, access_token };
  if (authorUrl.length <= 255) {
    obj.author_url = authorUrl;
  }
  const tgRes = await makeTelegaph(obj, content);
  const { telegraphLink, isLong, pages, push } = tgRes;
  if (!telegraphLink) throw 'empty ivlink';
  const res = { iv: telegraphLink, pages, push, title };

  if (paramsObj.db) {
    await db.updateOne({ url, ...res });
  }

  res.isLong = res.pages;
  return res;
};

const toUrl = (url) => {
  if (!url.match(/^(https?|ftp|file)/)) return `http://${url}`;
  return url;
};

const parse = (u) => {
  if (u.match(G)) {
    let p = u.split(/es\/(.*?)\?/);
    if (p) {
      p = from64(p[1]).toString();
      p = p.match(/^\x08\x13".(.*)\//);
      return p[1];
    }
  }
  return u;
};

const isText = async (u, q) => {
  if (q && q.match('cached')) {
    logger('cached is text = true');
    return { isText: true, url: u };
  }
  u = toUrl(u);
  if(!u.match('%')) u = encodeURI(u);
  const headersCheck = {
    "Accept":"text/html",
    "user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:21.0) Gecko/20100101 Firefox/21.0",
  }
  const r = await fetch(u, { timeout: 5000, headers: headersCheck });
  const { url, headers } = r;
  const contentType = headers.get('content-type') || '';
  logger(contentType);
  const isText = contentType.startsWith('text/');
  return { isText, url };
};

exports.parse = parse;
exports.isText = isText;
exports.makeIvLink = makeIvLink;
exports.makeIvLinkFromContent = makeIvLinkFromContent;
