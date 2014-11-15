/**
* @module  placer
*
* Places any element relative to any other element the way you define
*/
module.exports = place;


//TODO: use translate3d instead of absolute repositioning


var type = require('mutypes');
var css = require('mucss');
var q = require('query-relative');
var softExtend = require('soft-extend');
var m = require('mumath');
var align = require('aligner');


//shortcuts
var win = window, doc = document, root = doc.documentElement;


/**
 * Default options
 */
var defaults = {
	//an element to align relatively to
	//element
	relativeTo: win,

	//which side to place element
	//t/r/b/l, 'center', 'middle'
	side: 'center',

	/**
	 * An alignment trbl/0..1/center
	 *
	 * @default  0
	 * @type {(number|string|array)}
	 */
	align: 0,

	//selector/nodelist/node/[x,y]/window/function(el)
	avoid: undefined,

	//selector/nodelist/node/[x,y]/window/function(el)
	within: undefined,

	//look for better blacement, if doesn’t fit
	seekPosition: true
};


/**
 * Place element relative to the target by the side & params passed.
 *
 * @main
 *
 * @param {Element} element An element to place
 * @param {object} options Options object
 *
 * @return {boolean} The result of placement - whether placing succeeded
 */
function place(element, options){
	//ensure element
	element = q(element);

	//inherit defaults
	options = softExtend(options, defaults);

	//ensure elements
	options.relativeTo = options.relativeTo && q(options.relativeTo, element) || win;
	options.within = options.within && q(options.within, element);


	//set the same position as the target’s one or absolute
	if (type.isElement(options.relativeTo) && css.isFixed(options.relativeTo)) {
		element.style.position = 'fixed';
	}
	else {
		element.style.position = 'absolute';
	}


	//else place according to the position
	var side = options.seekPosition && options.within ? getBestSide(element, options) : options.side;

	placeBySide[side](element, options);


	return element;
}


/**
 * Set of positioning functions
 * @enum {Function}
 * @param {Element} placee Element to place
 * @param {object} target Offsets rectangle (absolute position)
 * @param {object} ignore Sides to avoid entering (usually, already tried)
 */
var placeBySide = {
	center: function(placee, opts){
		// console.log('place center');

		//get relativeTo & within rectangles
		var placerRect = css.offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);


		//align centered
		var al = opts.align;
		if (!(al instanceof Array)) {
			if (/,/.test(al)) {
				al = al.split(/\s*,\s*/);
				al = [parseFloat(al[0]), parseFloat(al[1])];
			}
			else if (/top|bottom|middle/.test(al)) al = [.5, al];
			else al = [al, .5];
		}

		align([opts.relativeTo, placee], al);


		//apply limits
		if (opts.within) {
			trimPositionY(placee, opts.within, parentRect);
			trimPositionX(placee, opts.within, parentRect);
		}


		//upd options
		opts.side = 'center';
	},

	left: function(placee, opts){
		// console.log('place left')

		var parent = placee.offsetParent;

		var placerRect = css.offsets(opts.relativeTo);
		var parentRect = getParentRect(parent);

		//correct borders
		includeBorders(parentRect, parent);


		//place left (set css right because placee width may change)
		css(placee, {
			right: parentRect.right - placerRect.left,
			left: 'auto'
		});

		//place vertically properly
		align([opts.relativeTo, placee], [null, opts.align]);


		//apply limits
		if (opts.within) trimPositionY(placee, opts.within, parentRect);


		//upd options
		opts.side = 'left';
	},

	right: function (placee, opts) {
		// console.log('place right')


		//get relativeTo & within rectangles
		var placerRect = css.offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);

		//correct borders
		includeBorders(parentRect, placee.offsetParent);


		//place right
		css(placee, {
			left: placerRect.right - parentRect.left,
			right: 'auto',
		});


		//place vertically properly
		align([opts.relativeTo, placee], [null, opts.align]);


		//apply limits
		if (opts.within) trimPositionY(placee, opts.within, parentRect);


		//upd options
		opts.side = 'right';
	},

	top: function(placee, opts){
		// console.log('place top');

		var parent = placee.offsetParent;
		var placerRect = css.offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);


		//correct borders
		includeBorders(parentRect, parent);


		//place vertically top-side
		css(placee, {
			bottom: parentRect.bottom - placerRect.top,
			top: 'auto'
		});


		//place horizontally properly
		align([opts.relativeTo, placee], [opts.align]);


		//apply limits
		if (opts.within) trimPositionX(placee, opts.within, parentRect);


		//upd options
		opts.side = 'top';
	},

	bottom: function(placee, opts){
		// console.log('place bottom');

		//get relativeTo & within rectangles
		var placerRect = css.offsets(opts.relativeTo);
		var parentRect = getParentRect(placee.offsetParent);


		//correct borders
		includeBorders(parentRect, placee.offsetParent);


		//place bottom
		css(placee, {
			top: placerRect.bottom - parentRect.top,
			bottom: 'auto',
		});


		//place horizontally properly
		align([opts.relativeTo, placee], [opts.align]);


		//apply limits
		if (opts.within) trimPositionX(placee, opts.within, parentRect);


		//upd options
		opts.side = 'bottom';
	}
};


/** Find the most appropriate side to place element */
function getBestSide(placee, opts) {
	var initSide = opts.side;

	var withinRect = css.offsets(opts.within),
		placeeRect = css.offsets(placee),
		placerRect = css.offsets(opts.relativeTo);

	//rect of available spaces
	var availSpace = {
		top: placerRect.top - withinRect.top - placeeRect.height,
		bottom: withinRect.bottom - placerRect.bottom - placeeRect.height,
		left: placerRect.left - withinRect.left - placeeRect.width,
		right: withinRect.right - placerRect.right - placeeRect.width
	};

	//if fits initial side, return it
	if (availSpace[initSide] >= 0) return initSide;

	//if none of sides fit, return center
	if (availSpace.top < 0 && availSpace.bottom < 0 && availSpace.left < 0 && availSpace.right < 0) return 'center';

	//else find the most free side within others
	var maxSide = initSide, maxSpace = availSpace[maxSide];
	for (var side in availSpace) {
		if (availSpace[side] > maxSpace) {
			maxSide = side; maxSpace = availSpace[maxSide];
		}
	}
	return maxSide;
}



/** include borders in offsets */
//FIXME: think of outskirting borders detection to offsets (inner/outer offsets)
function includeBorders(rect, el){
	//correct borders
	var borders = css.borders(el);
	rect.left += borders.left;
	rect.right -= borders.right;
	rect.bottom -= borders.bottom;
	rect.top += borders.top;
	return rect;
}


/** apply limits rectangle to the position of an element */
function trimPositionY(placee, within, parentRect){
	var placeeRect = css.offsets(placee);
	var withinRect = css.offsets(within);
	includeBorders(withinRect, within);

	if (withinRect.top > placeeRect.top) {
		css(placee, {
			top: withinRect.top - parentRect.top,
			bottom: 'auto'
		});
	}

	else if (withinRect.bottom < placeeRect.bottom) {
		css(placee, {
			top: 'auto',
			bottom: parentRect.bottom - withinRect.bottom
		});
	}
}
function trimPositionX(placee, within, parentRect){
	var placeeRect = css.offsets(placee);
	var withinRect = css.offsets(within);
	includeBorders(withinRect, within);

	if (withinRect.left > placeeRect.left) {
		css(placee, {
			left: withinRect.left - parentRect.left,
			right: 'auto'
		});
	}

	else if (withinRect.right < placeeRect.right) {
		css(placee, {
			left: 'auto',
			right: parentRect.right - withinRect.right
		});
	}
}


/**
 * Return offsets rectangle for an element/array/any target passed.
 * I. e. normalize offsets rect
 *
 * @param {*} el Element, selector, window, document, rect, array
 *
 * @return {object} Offsets rectangle
 */
function getParentRect(target){
	var rect;

	//handle special static body case
	if (target === doc.body || target === root && getComputedStyle(target).position === 'static'){
		rect = {
			left: 0,
			right: win.innerWidth - (css.hasScrollY() ? css.scrollbar : 0),
			width: win.innerWidth,
			top: 0,
			bottom: win.innerHeight - (css.hasScrollX() ? css.scrollbar : 0),
			height: win.innerHeight
		};
	}
	else {
		rect = css.offsets(target);
	}

	return rect;
}