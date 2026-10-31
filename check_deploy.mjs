import https from 'https';

https.get('https://iiiiiiiiiiiiikk.github.io/snaptext/', { timeout: 30000 }, (res) => {
  let b = '';
  res.on('data', (c) => { b += c; });
  res.on('end', () => {
    const m = b.match(/(src|href)="[^"]+"/g) || [];
    console.log('DEPLOYED ASSET PATHS:');
    m.forEach((x) => console.log(x));
    const title = b.match(/<title>(.*)<\/title>/i);
    console.log('TITLE:', title ? title[1] : '(none)');
  });
}).on('error', (e) => console.log('ERR', e.message));