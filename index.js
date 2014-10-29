/**
* @module  placer
*
* Places any element relative to any other element the way you define
*/
module.exports = place;


var type = require('mutypes');
var css = require('mucss');


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
	options = softExtend(options, defaults);

	//recalc align
	options.align = getAlign(options.align);

	//calc within container
	var withinRect = getRect(options.within);

	//set the position as of the target
	if (type.isElement(options.relativeTo) && css.isFixed(options.relativeTo)) {
		element.style.position = 'fixed';
	}
	else {
		element.style.position = 'absolute';
		//correct win offsets in case of absolute placement
		if (options.within === win) {
			withinRect.top += win.pageYOffset;
			withinRect.bottom += win.pageYOffset;
			withinRect.left += win.pageXOffset;
			withinRect.right += win.pageXOffset;
		}
	}

	//placer rect afterwards (its rect may have changed due to position change)
	var relativeToRect = getRect(options.relativeTo);


	//check whether there’s enough place (avoid placing redirection loop)
	// var margins = css.margins(element);
	// var requiredWidth = elementRect.width + relativeToRect.width + (margins.left + margins.right) * 1.1;
	// var requiredHeight = elementRect.height + relativeToRect.height + (margins.top + margins.bottom) * 1.1;


	// //if not - place centered
	// if (requiredWidth > withinRect.width && requiredHeight > withinRect.height)
	// 	placeBySide.center(element, relativeToRect, withinRect, options);


	//else place according to the position
	placeBySide[options.side](element, relativeToRect, withinRect, options);


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
	center: function(placee, placerRect, within, opts){
		// console.log('place center');

		var center = [(placerRect.left + placerRect.right) *.5, (placerRect.bottom + placerRect.top) *.5];
		var width = placee.offsetWidth;
		var height = placee.offsetHeight;

		css(placee, {
			top: (center[1] - height*.5),
			left: (center[0] - width*.5)
		});

		//upd options
		opts.side = 'center';
	},

	left: function(placee, placerRect, within, opts){
		// console.log('place left')

		var width = placee.offsetWidth;
		var height = placee.offsetHeight;

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


		//get reliable parent width
		var parent = placee.offsetParent;
		var parentWidth = parent && parent.offsetWidth || 0;
		if (parent === doc.body || parent === root && win.getComputedStyle(parent).position === 'static') parentWidth = win.innerWidth;

		//place left
		css(placee, {
			right: parentWidth - placerRect.left - 18,
			left: 'auto'
		});

		//place vertically properly
		placeVertically.apply(this, arguments);

		//upd options
		opts.side = 'left';
	},

	right: function(placee, placerRect, within, opts){
		// console.log('place right')

		var width = placee.offsetWidth;
		var height = placee.offsetHeight;

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

		//place right
		css(placee, {
			left: placerRect.right,
			right: 'auto',
		});

		//place vertically properly
		placeVertically.apply(this, arguments);

		//upd options
		opts.side = 'right';
	},

	top: function(placee, placerRect, within, opts){
		// console.log('place top');

		var width = placee.offsetWidth;
		var height = placee.offsetHeight;

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

		//place horizontally properly
		placeHorizontally.apply(this, arguments);


		//place vertically top-side
		var bottom = getParentHeight(placee) - placerRect.top;
		css(placee, {
			bottom: bottom,
			top: 'auto'
		});

		//check whether bottom scrollbar needs to be subtracted
		if (hasScrollbarX()){
			css(placee, 'bottom', bottom - css.scrollbar);
		}

		//upd options
		opts.side = 'top';
	},

	bottom: function(placee, placerRect, within, opts){
		// console.log('place bottom');

		var height = placee.offsetHeight;
		var width = placee.offsetWidth;
		var margins = css.margins(placee);

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

		//place horizontally properly
		placeHorizontally.apply(this, arguments);

		//calc doc.body offset, margin may collapse
		var parent = placee.offsetParent;
		var bodyOffsetY = 0;
		if ((parent === doc.body || parent === root) && win.getComputedStyle(parent).position !== 'static') bodyOffsetY = css.offsets(parent).top;

		//place bottom
		css(placee, {
			top: placerRect.bottom - bodyOffsetY,
			bottom: 'auto',
		});

		//upd options
		opts.side = 'bottom';
	}
};


/**
 * Horizontal placer for the top and bottom sides
 */
function placeHorizontally ( placee, placerRect, within, opts ){
	var width = placee.offsetWidth;
	var margins = css.margins(placee);
	var desirableLeft = placerRect.left + placerRect.width*opts.align - width*opts.align;

	//if within is defined - mind right border
	if (within) {
		if (width + desirableLeft < within.right){
			css(placee, {
				left: Math.max(desirableLeft, within.left),
				right: 'auto'
			});
		}
		//if too close to the within right - set right = 0
		else {
			css(placee, {
				right: 0,
				left: 'auto'
			});
		}
	}

	//if no within - place absolutely
	else {
		css(placee, {
			left: desirableLeft,
			right: 'auto'
		});
	}
}


/**
 * Vertical placerRect for the left and right sides
 */
function placeVertically ( placee, placerRect, within, opts ) {
	var height = placee.offsetHeight;
	var margins = css.margins(placee);
	var desirableTop = placerRect.top + placerRect.height*opts.align - height*opts.align;

	//if within is defined - apply capping position
	if (within){
		//if too close to the `within.right` - set right = 0
		if (height + desirableTop > within.bottom) {
			css(placee, {
				bottom: 0,
				top: 'auto'
			});
		}
		else {
			css(placee, {
				top: Math.max(desirableTop, within.top),
				bottom: 'auto'
			});
		}
	}

	//else place regardless of position
	else {
		css(placee, {
			top: desirableTop,
			bottom: 'auto'
		});
	}
}


/**
 * Return reliable parent height
 */
function getParentHeight(placee){
	var parent = placee.offsetParent;
	var parentHeight = parent && parent.offsetHeight || 0;

	//get reliable parent height
	//body & html with position:static tend to consider bottom:0 as a viewport bottom
	//so take the parentHeight for the vp height
	if ((parent === doc.body || parent === root) && win.getComputedStyle(parent).position === 'static') parentHeight = win.innerHeight;

	return parentHeight;
}


/**
 * Return offsets rectangle of an element/array/any target passed.
 * I. e. normalize offsets rect
 *
 * @param {*} el Element, selector, window, document, rect, array
 *
 * @return {object} Offsets rectangle
 */
function getRect(target){
	var rect = target;

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
		rect = css.offsets(target);
	}
	else if (type.isString(target)) {
		var targetEl = doc.querySelector(target);
		if (!targetEl) throw Error('No element queried by `' + target + '`');

		rect = css.offsets(targetEl);
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
		if (target.width === undefined) target.width = target.right - target.left;
		if (target.height === undefined) target.height = target.bottom - target.top;
	}

	return rect;
}


/**
 * Alignment setter
 *
 * @param {string|number} value Convert any value passed to float 0..1
 */
function getAlign(value){
	if (!value) return 0;

	if (type.isString(value)) {
		switch (value) {
			case 'left':
			case 'top':
				return 0;
			case 'right':
			case 'bottom':
				return 1;
			case 'center':
			case 'middle':
				return 0.5;
		}
	}
	var num = parseFloat(value);

	return num !== undefined ? num : 0.5;
}


/**
 * Soft extender (appends lacking props)
 */
function softExtend(a,b){
	//ensure object
	if (!a) a = {};

	for (var i in b){
		if (a[i] === undefined) a[i] = b[i];
	}

	return a;
}


/** test whether window is scrollable by x */
function hasScrollbarX(){
	return window.innerHeight > root.clientHeight;
}