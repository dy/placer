/**
* Placer
* Places any element relative to any other element the way you define
*/

module.exports = place;

var css = require('mucss');

var win = window;

//default options
var defaults = {
	//source to align relatively to
	//element/{x,y}/[x,y]/
	relativeTo: window,

	//which side to palce element
	//t/r/b/l, 'center' ( === undefined),
	side: 'center',

	//intensity of alignment
	//left, center, right, top, bottom, 0..1
	align: 0.5,

	//selector/nodelist/node/[x,y]/window/function(el)
	avoid: undefined,

	//selector/nodelist/node/[x,y]/window/function(el)
	within: window
};

//set of position placers
var placeBySide = {
	center: function(placee, rect){
		var center = [(rect[2] + rect[0]) / 2, (rect[3] + rect[1]) / 2];
		var width = placee.offsetWidth;
		var height = placee.offsetHeight;
		css(placee, {
			top: (center[1] - height/2),
			left: (center[0] - width/2)
		});
	},

	left: function(el, rect){

	},

	right: function(el, rect){

	},

	top: function(el, rect){

	},

	bottom: function(el, rect){
		var width = el.offsetWidth;
		var height = el.offsetHeight;
		css(placee, {
			left: rect[0],
			top: rect[3]
		});
	}
};


//place element relative to the target on the side
function place(element, options){
	options = options || {};

	//get target rect to align
	var target = options.relativeTo || defaults.relativeTo;
	var targetRect;

	if (target === win) {
		targetRect = [0, 0, win.innerWidth, win.innerHeight];
	}
	else if (target instanceof Element) {
		var rect = target.getBoundingClientRect();
		targetRect = [rect.left, rect.top, rect.right, rect.bottom];
	}
	else if (typeof target === 'string'){
		var targetEl = document.querySelector(target);
		if (!targetEl) return false;
		// var rect;
	}

	//align according to the position
	var side = options.side || defaults.side;

	placeBySide[side](element, targetRect);
}