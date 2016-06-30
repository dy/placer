var test = require('tst');
var place = require('./');
var ipsum = require('lorem-ipsum');


document.body.innerHTML = `${ipsum({count: 15, units: 'paragraph', format: 'html'})}`;


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

test('restricted by window', function () {
	var el = document.createElement('div');
	el.style.position = 'absolute';
	el.style.width = '100px';
	el.style.height = '100px';
	el.style.border = '1px solid gray';
	el.innerHTML = 'content';
	el.style.background = 'white';

	place(el, {
		side: 'center',
		align: 'center',
		within: window
	});
});

test('autoside', function () {
	var el = document.createElement('div');
	el.style.position = 'absolute';
	el.style.width = '100px';
	el.style.height = '100px';
	el.style.border = '1px solid gray';
	el.innerHTML = 'autoside';
	el.style.background = 'white';

	place(el, {
	});
});