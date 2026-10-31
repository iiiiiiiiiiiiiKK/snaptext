import https from 'https';

https.get('https://iiiiiiiiiiiiikk.github.io/snaptext/', { timeout: 30000 }, (res) => {
  let b = '';
  res.on('data', (c) => { b += c; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('LEN:', b.length, 'bytes');
    console.log('HAS root div:', b.includes('id="root"'));
    console.log('HAS SnapText:', b.includes('SnapText'));
    console.log('ASSET JS correct:', b.includes('/snaptext/assets/index-DpUziS3n.js'));
    console.log('ASSET CSS correct:', b.includes('/snaptext/assets/index-CWZYVJn8.css'));
  });
}).on('error', (e) => console.log('ERR', e.message));