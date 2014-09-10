/**
* @module  placer
*
* Places any element relative to any other element the way you define
*/
module.exports = place;

var type = require('mutypes');
var css = require('mucss');


//shortcuts
var win = window, doc = document, root = doc.documentElement, body = doc.body;


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

	//set of sides to ignore positioning, {top:true, ...}
	ignore: {},

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
 * Set of position placers
 * @enum {Function}
 * @param {Element} placee Element to place
 * @param {object} target Offsets rectangle (absolute position)
 * @param {object} ignore Sides to avoid entering (usually, already tried)
 */

var placeBySide = {
	center: function(placee, target, within, opts){
		console.log('place center');

		var center = [(target.left + target.right) *.5, (target.bottom + target.top) *.5];
		var width = placee.offsetWidth;
		var height = placee.offsetHeight;

		css(placee, {
			top: (center[1] - height*.5),
			left: (center[0] - width*.5)
		});

		//upd options
		opts.side = 'center';
	},

	left: function(placee, target, within, opts){
		console.log('place left')

		var width = placee.offsetWidth;
		var height = placee.offsetHeight;

		//check if there is enough place for placing from the left
		if (width > Math.abs(within.left - target.left)) {
			opts.ignore.left = true;

			//if not - compare left/bottom displacement and place whether vertically or inverse
			if (Math.abs(target.top - within.top) > Math.abs(within.left - target.left) && !opts.ignore.right){
				return placeBySide.right.apply(this, arguments);
			} else {
				return placeBySide.bottom.apply(this, arguments);
			}
		}


		//get reliable parent width
		var parent = placee.offsetParent;
		var parentWidth = parent.offsetWidth;
		if (parent === body || parent === root && win.getComputedStyle(parent).position === 'static') parentWidth = win.innerWidth;

		//place left
		css(placee, {
			right: parentWidth - target.left - 18,
			left: 'auto'
		});

		//place vertically properly
		placeVertically.apply(this, arguments);

		//upd options
		opts.side = 'left';
	},

	right: function(placee, target, within, opts){
		console.log('place right')

		var width = placee.offsetWidth;
		var height = placee.offsetHeight;

		//check if there is enough place for placing bottom
		if (width > Math.abs(within.right - target.right)) {
			opts.ignore.right = true;

			//if not - compare top/right displacement and place whether aside or inverse
			if (Math.abs(target.top - within.top) > Math.abs(within.right - target.right) && !opts.ignore.left){
				return placeBySide.left.apply(this, arguments);
			} else {
				return placeBySide.bottom.apply(this, arguments);
			}
		}

		//place right
		css(placee, {
			left: target.right,
			right: 'auto',
		});

		//place vertically properly
		placeVertically.apply(this, arguments);

		//upd options
		opts.side = 'right';
	},

	top: function(placee, target, within, opts){
		console.log('place top');

		var width = placee.offsetWidth;
		var height = placee.offsetHeight;

		//check if there is enough place for placing top
		if (height > Math.abs(within.top - target.top)) {
			opts.ignore.top = true;

			//if not - compare left/top displacement and place whether aside or inverse
			if (Math.abs(target.left - within.left) > Math.abs(within.top - target.top) && !opts.ignore.bottom){
				return placeBySide.bottom.apply(this, arguments);
			} else {
				return placeBySide.left.apply(this, arguments);
			}
		}

		//place horizontally properly
		placeHorizontally.apply(this, arguments);

		//place top
		var parent = placee.offsetParent;
		var parentHeight = parent.offsetHeight;

		//get reliable parent height
		//body & html with position:static tend to consider bottom:0 as a viewport bottom
		//so take the parentHeight for the vp height

		if (parent === body || parent === root && win.getComputedStyle(parent).position === 'static') parentHeight = win.innerHeight;
		css(placee, {
			bottom: parentHeight - target.top,
			top: 'auto'
		});

		//upd options
		opts.side = 'top';
	},

	bottom: function(placee, target, within, opts){
		console.log('place bottom');

		var height = placee.offsetHeight;
		var width = placee.offsetWidth;
		var margins = css.margins(placee);

		//check if there is enough place for placing bottom
		if (height + margins.top + margins.bottom > Math.abs(within.bottom - target.bottom)) {
			opts.ignore.bottom = true;

			//if not - compare left/bottom displacement and place whether aside or inverse
			if (Math.abs(target.left - within.left) > Math.abs(within.bottom - target.bottom) && !opts.ignore.top){
				return placeBySide.top.apply(this, arguments);
			} else {
				return placeBySide.left.apply(this, arguments);
			}
		}

		//place bottom
		css(placee, {
			top: target.bottom,
			bottom: 'auto',
		});

		//place horizontally properly
		placeHorizontally.apply(this, arguments);

		//upd options
		opts.side = 'bottom';
	}
};


/**
 * Horizontal placer for the top and bottom sides
 */

function placeHorizontally(placee, target, within, opts){
	var width = placee.offsetWidth;
	var margins = css.margins(placee);
	var desirableLeft = target.left + target.width*opts.align - width*opts.align;

	//if too close to the within right - set right = 0
	if (width + desirableLeft > within.right) {
		css(placee, {
			right: 0,
			left: 'auto'
		});
	}
	else {
		css(placee, {
			left: Math.max(desirableLeft, within.left),
			right: 'auto'
		});
	}
}


/**
 * Vertical placer for the left and right sides
 */

function placeVertically ( placee, target, within, opts ) {
	var height = placee.offsetHeight;
	var margins = css.margins(placee);
	var desirableTop = target.top + target.height*opts.align - height*opts.align;

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

	//calc containers
	var withinRect = getRect(options.within);
	var relativeToRect = getRect(options.relativeTo);
	var elementRect = getRect(element);


	//set the position as of the target
	if (css.isFixed(options.relativeTo)) {
		element.style.position = 'fixed';
	}
	else {
		element.style.position = 'absolute';

		//get proper win offsets
		if (options.within === win) {
			withinRect.top += win.pageYOffset;
			withinRect.bottom += win.pageYOffset;
			withinRect.left += win.pageXOffset;
			withinRect.right += win.pageXOffset;
		}
	}


	//check whether there’s enough place (avoid placing redirection loop)
	var margins = css.margins(element);
	var requiredWidth = elementRect.width + relativeToRect.width + (margins.left + margins.right) * 1.1;
	var requiredHeight = elementRect.height + relativeToRect.height + (margins.top + margins.bottom) * 1.1;


	//if not - place centered
	if (requiredWidth > withinRect.width && requiredHeight > withinRect.height)
		placeBySide.center(element, relativeToRect, withinRect, options);

	//else place according to the position
	else placeBySide[options.side](element, relativeToRect, withinRect, options);


	return element;
}


/**
 * Return offsets rectangle of an element
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
			right: body.offsetWidth,
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
