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
	//source to align relatively to
	//element/{x,y}/[x,y]/
	relativeTo: window,

	//which side to palce element
	//t/r/b/l, 'center' ( === undefined),
	side: 'center',

	/**
	 * Side to align: trbl/0..1/center
	 *
	 * @default  0
	 * @type {(number|string)}
	 */
	align: 0,

	//selector/nodelist/node/[x,y]/window/function(el)
	avoid: undefined,

	//selector/nodelist/node/[x,y]/window/function(el)
	within: undefined
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

	//set the same position as the target’s one
	var isAbsolute = false;
	if (type.isElement(options.relativeTo) && css.isFixed(options.relativeTo)) {
		element.style.position = 'fixed';
	}
	else {
		element.style.position = 'absolute';
		isAbsolute = true;
	}

	//correct win offsets in case of absolute placement
	if (isAbsolute && options.within === win) {
		withinRect.top += win.pageYOffset;
		withinRect.bottom += win.pageYOffset;
		withinRect.left += win.pageXOffset;
		withinRect.right += win.pageXOffset;
	}

	//check whether there’s enough place (avoid placing redirection loop)
	// var margins = css.margins(element);
	// var requiredWidth = elementRect.width + relativeToRect.width + (margins.left + margins.right) * 1.1;
	// var requiredHeight = elementRect.height + relativeToRect.height + (margins.top + margins.bottom) * 1.1;


	// //if not - place centered
	// if (requiredWidth > withinRect.width && requiredHeight > withinRect.height)
	// 	placeBySide.center(element, relativeToRect, withinRect, options);

	//else place according to the position
	placeBySide[options.side](element, options);


	return element;
}


/**
 * Set of position placerRects
 * @enum {Function}
 * @param {Element} placee Element to place
 * @param {object} target Offsets rectangle (absolute position)
 * @param {object} ignore Sides to avoid entering (usually, already tried)
 */
var placeBySide = {
	center: function(placee, opts){
		// console.log('place center');

		//get relativeTo & within rectangles
		var placerRect = getRect(opts.relativeTo);
		var withinRect = getRect(opts.within);
		var parentRect = getRect(placee.offsetParent);


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


		//upd options
		opts.side = 'center';
	},

	left: function(placee, opts){
		// console.log('place left')

		//get relativeTo & within rectangles
		var placerRect = getRect(opts.relativeTo);
		var withinRect = getRect(opts.within);
		var parentRect = getRect(placee.offsetParent);


		//check if there is enough place for placing from the left
		// if (width > Math.abs(within.left - placerRect.left)) {
		// 	opts.ignore.left = true;

		// 	//if not - compare left/bottom displacement and place whether vertically or inverse
		// 	if (Math.abs(placerRect.top - within.top) > Math.abs(within.left - placerRect.left) && !opts.ignore.right){
		// 		return placeBySide.right.apply(this, arguments);
		// 	} else {
		// 		return placeBySide.bottom.apply(this, arguments);
		// 	}
		// }

		//add corrective if parent is body with static positioning
		var parent = placee.offsetParent;

		//correct borders
		includeBorders(parentRect, parent);
		opts.within && includeBorders(withinRect, opts.within);

		//place left (set css right because placee width may change)
		//FIXME: we suppose that placee and placer are in the same container, but they can be in different
		css(placee, {
			right: parentRect.right - placerRect.left,
			left: 'auto'
		});

		//place vertically properly
		align([opts.relativeTo, placee], [null, opts.align]);

		//upd options
		opts.side = 'left';
	},

	right: function (placee, opts) {
		// console.log('place right')


		//get relativeTo & within rectangles
		var placerRect = getRect(opts.relativeTo);
		var withinRect = getRect(opts.within);
		var parentRect = getRect(placee.offsetParent);



		//check if there is enough place for placing bottom
		// if (width > Math.abs(within.right - placerRect.right)) {
		// 	opts.ignore.right = true;

		// 	//if not - compare top/right displacement and place whether aside or inverse
		// 	if (Math.abs(placerRect.top - within.top) > Math.abs(within.right - placerRect.right) && !opts.ignore.left){
		// 		return placeBySide.left.apply(this, arguments);
		// 	} else {
		// 		return placeBySide.bottom.apply(this, arguments);
		// 	}
		// }


		//correct borders
		includeBorders(parentRect, placee.offsetParent);
		opts.within && includeBorders(withinRect, opts.within);

		//place right
		css(placee, {
			left: placerRect.right - parentRect.left,
			right: 'auto',
		});

		//place vertically properly
		align([opts.relativeTo, placee], [null, opts.align]);

		//upd options
		opts.side = 'right';
	},

	top: function(placee, opts){
		// console.log('place top');

		//get relativeTo & within rectangles
		var placerRect = getRect(opts.relativeTo);
		var withinRect = getRect(opts.within);
		var parentRect = getRect(placee.offsetParent);


		//check if there is enough place for placing top
		// if (height > Math.abs(within.top - placerRect.top)) {
		// 	opts.ignore.top = true;

		// 	//if not - compare left/top displacement and place whether aside or inverse
		// 	if (Math.abs(placerRect.left - within.left) > Math.abs(within.top - placerRect.top) && !opts.ignore.bottom){
		// 		return placeBySide.bottom.apply(this, arguments);
		// 	} else {
		// 		return placeBySide.left.apply(this, arguments);
		// 	}
		// }


		var parent = placee.offsetParent;

		//correct borders
		includeBorders(parentRect, placee.offsetParent);
		opts.within && includeBorders(withinRect, opts.within);


		//place vertically top-side
		var bottom = parentRect.bottom - placerRect.top;

		css(placee, {
			bottom: bottom,
			top: 'auto'
		});


		//place horizontally properly
		align([opts.relativeTo, placee], [opts.align]);


		//upd options
		opts.side = 'top';
	},

	bottom: function(placee, opts){
		// console.log('place bottom');

		//get relativeTo & within rectangles
		var placerRect = getRect(opts.relativeTo);
		var withinRect = getRect(opts.within);
		var parentRect = getRect(placee.offsetParent);

		//check if there is enough place for placing bottom
		// if (height + margins.top + margins.bottom > Math.abs(within.bottom - placerRect.bottom)) {
		// 	opts.ignore.bottom = true;

		// 	//if not - compare left/bottom displacement and place whether aside or inverse
		// 	if (Math.abs(placerRect.left - within.left) > Math.abs(within.bottom - placerRect.bottom) && !opts.ignore.top){
		// 		return placeBySide.top.apply(this, arguments);
		// 	} else {
		// 		return placeBySide.left.apply(this, arguments);
		// 	}
		// }

		//correct borders
		includeBorders(parentRect, placee.offsetParent);
		opts.within && includeBorders(withinRect, opts.within);


		//place bottom
		css(placee, {
			top: placerRect.bottom - parentRect.top,
			bottom: 'auto',
		});


		//place horizontally properly
		align([opts.relativeTo, placee], [opts.align]);


		//upd options
		opts.side = 'bottom';
	}
};


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



/**
 * Return offsets rectangle for an element/array/any target passed.
 * I. e. normalize offsets rect
 *
 * @param {*} el Element, selector, window, document, rect, array
 *
 * @return {object} Offsets rectangle
 */
function getRect(target){
	var rect;

	if (target === win) {
		rect = {
			top: 0,
			left: 0,
			right: doc.body.offsetWidth,
			bottom: win.innerHeight,
		};
		rect.width = rect.right - rect.left;
		rect.height = rect.bottom - rect.top;
	}
	else if (type.isElement(target)) {
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
	}
	else if (type.isArray(target)){
		//[left, top]
		if (target.length === 2){
			return {
				top: target[1],
				left: target[0],
				bottom: target[1],
				right: target[0],
				width: 0,
				height: 0
			};
		}
		//[left,top,right,bottom]
		else if (target.length === 4){
			return {
				left: target[0],
				top: target[1],
				right: target[2],
				bottom: target[3],
				width: target[2] - target[0],
				height: target[3] - target[1]
			};
		}
	}
	else if (type.isObject(target)){
		rect = target;
		if (target.width === undefined) target.width = target.right - target.left;
		if (target.height === undefined) target.height = target.bottom - target.top;
	}

	return rect;
}