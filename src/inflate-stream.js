var bodec = require('bodec');

var inflateStream = require('js-git/lib/inflate-stream');
var deflate = require('js-git/lib/deflate');

var data = bodec.join([deflate("Hello World"), bodec.fromRaw("Good Bye World")]);

var inf = inflateStream();

var i = 0;
while (i < data.length && inf.write(data[i++]));
console.log(bodec.toRaw(inf.flush()));
inf.recycle();
console.log(bodec.toRaw(data, i));
