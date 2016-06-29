var test = require('tst');
var place = require('./');



test('centered in window', function () {
	var el = document.createElement('div');
	el.style.position = 'absolute';
	el.style.width = '100px';
	el.style.height = '100px';
	el.style.border = '1px solid gray';
	el.innerHTML = 'content';

	place(el, {
		target: window,
		side: 'center',
		align: 'center'
	});
});