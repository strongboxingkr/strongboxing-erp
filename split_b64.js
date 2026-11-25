const fs = require('fs');
const b64 = fs.readFileSync('C:/Users/admin/AppData/Local/Temp/ezis_members_b64.txt', 'ascii');
const chunkSize = 50000;
const chunks = [];
for (let i = 0; i < b64.length; i += chunkSize) {
  chunks.push(b64.slice(i, i + chunkSize));
}
console.log('총 길이:', b64.length, '청크 수:', chunks.length);
chunks.forEach((c, i) => {
  fs.writeFileSync(`C:/Users/admin/AppData/Local/Temp/ezis_chunk_${i}.txt`, c, 'ascii');
  console.log(`청크 ${i}: ${c.length}자`);
});
