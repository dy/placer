/**
* @module  placer
*
* Places any element relative to any other element the way you define
*/

//TODO: use translate3d instead of absolute repositioning (option?)
//TODO: implement avoiding strategy (graphic editors use-case when you need to avoid placing over selected elements)
//TODO: enhance best-side strategy: choose the most closest side

var css = require('mucss/css');
var scrollbarWidth = require('mucss/scrollbar');
var isFixed = require('mucss/is-fixed');
var offsets = require('mucss/offset');
var hasScroll = require('mucss/has-scroll');
var borders = require('mucss/border');
var margins = require('mucss/margin');
var softExtend = require('soft-extend');
var align = require('aligner');
var parseValue = require('mucss/parse-value');

//shortcuts
var win = window, doc = document, root = doc.documentElement;


module.exports = place;

place.align = align;
place.toFloat = align.toFloat;

/**
 * Default options
 */
var defaults = {
	//an element to align relatively to
	//element
	target: win,

	//which side to place element
	//t/r/b/l, 'center', 'middle'
	side: 'auto',

	/**
	 * An alignment trbl/0..1/center
	 *
	 * @default  0
	 * @type {(number|string|array)}
	 */
	align: 0.5,

	//selector/nodelist/node/[x,y]/window/function(el)
	avoid: undefined,

	//selector/nodelist/node/[x,y]/window/function(el)
	within: window,

	//look for better blacement, if doesn’t fit
	auto: true
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
function place (element, options) {
	//inherit defaults
	options = softExtend(options, defaults);

	options.target = options.target || options.to || win;

	if (!options.within) {
		options.within = options.target === win ? win : root;
	}

	//TODO: query avoidables
	// options.avoid = q(element, options.avoid, true);


	//set the same position as the target or absolute
	var elStyle = getComputedStyle(element);
	if (elStyle.position === 'static') {
		if (options.target instanceof Element && isFixed(options.target)) {
			element.style.position = 'fixed';
		}
		else {
			element.style.position = 'absolute';
		}
	}

	//force placing into DOM
	if (!document.contains(element)) (document.body || document.documentElement).appendChild(element);


	//else place according to the position
	var side = (options.auto || options.side === 'auto') ? getBestSide(element, options) : options.side;
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
		//get to & within rectangles
		var targetRect = offsets(opts.target);
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

		align([opts.target, placee], al);

		//apply limits
		//FIXME: understand this use-case when it should be called for centered view
		if (opts.within && opts.within !== window) {
			trimPositionY(placee, opts, parentRect);
			trimPositionX(placee, opts, parentRect);
		}


		//upd options
		opts.side = 'center';
	},

	left: function(placee, opts){
		var parent = placee.offsetParent || document.body || root;

		var targetRect = offsets(opts.target);
		var parentRect = getParentRect(parent);

		//correct borders
		contractRect(parentRect, borders(parent));


		//place left (set css right because placee width may change)
		css(placee, {
			right: parentRect.right - targetRect.left,
			left: 'auto'
		});

		//place vertically properly
		align([opts.target, placee], [null, opts.align]);


		//apply limits
		if (opts.within) trimPositionY(placee, opts, parentRect);


		//upd options
		opts.side = 'left';
	},

	right: function (placee, opts) {
		var parent = placee.offsetParent || document.body || root;

		//get to & within rectangles
		var targetRect = offsets(opts.target);
		var parentRect = getParentRect(parent);

		//correct borders
		contractRect(parentRect, borders(parent));


		//place right
		css(placee, {
			left: targetRect.right - parentRect.left,
			right: 'auto',
		});


		//place vertically properly
		align([opts.target, placee], [null, opts.align]);


		//apply limits
		if (opts.within) trimPositionY(placee, opts, parentRect);


		//upd options
		opts.side = 'right';
	},

	top: function(placee, opts){
		var parent = placee.offsetParent || document.body || root;

		var targetRect = offsets(opts.target);
		var parentRect = getParentRect(parent);

		//correct borders
		contractRect(parentRect, borders(parent));

		if (isFixed(placee)) {
			parentRect.top = 0;
			parentRect.bottom = window.innerHeight;
			targetRect.top -= window.pageYOffset;
			targetRect.bottom -= window.pageYOffset;
		}

		//place vertically top-side
		css(placee, {
			bottom: parentRect.bottom - targetRect.top,
			top: 'auto'
		});


		//place horizontally properly
		align([opts.target, placee], [opts.align]);


		//apply limits
		if (opts.within) trimPositionX(placee, opts, parentRect);


		//upd options
		opts.side = 'top';
	},

	bottom: function(placee, opts){
		var parent = placee.offsetParent || document.body || root;

		//get to & within rectangles
		var targetRect = offsets(opts.target);
		var parentRect = getParentRect(parent);


		//correct borders
		contractRect(parentRect, borders(parent));

		if (isFixed(placee)) {
			parentRect.top = 0;
			parentRect.bottom = window.innerHeight;
			targetRect.top -= window.pageYOffset;
			targetRect.bottom -= window.pageYOffset;
		}

		//place bottom
		css(placee, {
			top: targetRect.bottom - parentRect.top,
			bottom: 'auto',
		});


		//place horizontally properly
		align([opts.target, placee], [opts.align]);


		//apply limits
		if (opts.within) trimPositionX(placee, opts, parentRect);


		//upd options
		opts.side = 'bottom';
	}
};


/**
 * Find the most appropriate side to place element
 */
function getBestSide (placee, opts) {
	var initSide = opts.side === 'auto' ? 'bottom' : opts.side;

	var withinRect = offsets(opts.within),
		placeeRect = offsets(placee),
		targetRect = offsets(opts.target);

	contractRect(withinRect, borders(opts.within));

	var placeeMargins = margins(placee);

	//rect of "hot" area (available spaces from placer to container)
	var hotRect = {
		top: targetRect.top - withinRect.top,
		bottom: withinRect.bottom - targetRect.bottom,
		left: targetRect.left - withinRect.left,
		right: withinRect.right - targetRect.right
	};

	//rect of available spaces
	var availSpace = {
		top: hotRect.top - placeeRect.height - placeeMargins.top - placeeMargins.bottom,
		bottom: hotRect.bottom - placeeRect.height - placeeMargins.top - placeeMargins.bottom,
		left: hotRect.left - placeeRect.width - placeeMargins.left - placeeMargins.right,
		right: hotRect.right - placeeRect.width - placeeMargins.left - placeeMargins.right
	};

	//TODO: if avoidable el is within the hot area - specify the side limits


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



/** contract rect 1 with rect 2 */
function contractRect(rect, rect2){
	//correct rect2
	rect.left += rect2.left;
	rect.right -= rect2.right;
	rect.bottom -= rect2.bottom;
	rect.top += rect2.top;
	return rect;
}


/** Apply limits rectangle to the position of an element */
function trimPositionY(placee, opts, parentRect){
	var within = opts.within;

	var placeeRect = offsets(placee);
	var withinRect = offsets(within);
	var placeeMargins = margins(placee);

	if (within === window && isFixed(placee)) {
		withinRect.top = 0;
		withinRect.left = 0;
	}

	contractRect(withinRect, borders(within));

	//shorten withinRect by the avoidable elements
	//within the set of avoidable elements find the ones
	if (opts.avoid) {

	}

	if (withinRect.top > placeeRect.top - placeeMargins.top) {
		css(placee, {
			top: withinRect.top - parentRect.top,
			bottom: 'auto'
		});
	}

	else if (withinRect.bottom < placeeRect.bottom + placeeMargins.bottom) {
		css(placee, {
			top: 'auto',
			bottom: parentRect.bottom - withinRect.bottom
		});
	}
}
function trimPositionX(placee, opts, parentRect){
	var within = opts.within;

	var placeeRect = offsets(placee);
	var withinRect = offsets(within);
	var placeeMargins = margins(placee);

	if (within === window && isFixed(placee)) {
		withinRect.top = 0;
		withinRect.left = 0;
	}

	contractRect(withinRect, borders(within));

	if (withinRect.left > placeeRect.left - placeeMargins.left) {
		css(placee, {
			left: withinRect.left - parentRect.left,
			right: 'auto'
		});
	}

	else if (withinRect.right < placeeRect.right + placeeMargins.right) {
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
function getParentRect (target) {
	var rect;

	//handle special static body case
	if (target == null || (target === window) || (target === doc.body && getComputedStyle(target).position === 'static') || target === root) {
		rect = {
			left: 0,
			right: win.innerWidth - (hasScroll.y() ? scrollbarWidth : 0),
			width: win.innerWidth,
			top: 0,
			bottom: win.innerHeight - (hasScroll.x() ? scrollbarWidth : 0),
			height: win.innerHeight
		};
	}
	else {
		rect = offsets(target);
	}

	return rect;
}