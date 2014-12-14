# Placer [![Code Climate](https://codeclimate.com/github/dfcreative/placer/badges/gpa.svg)](https://codeclimate.com/github/dfcreative/placer) <a href="UNLICENSE"><img src="http://upload.wikimedia.org/wikipedia/commons/6/62/PD-icon.svg" width="20"/></a>

Place any two DOM elements in a way you like. Mainly needed for dropdowns, tooltips, modals, notifiers and any kind of overlays.

[Demo & tests](https://cdn.rawgit.com/dfcreative/placer/master/test/index.html)


## Usage

You need browserify or alike to use _placer_.

`$ npm install placer`

```js
var place = require('placer');

place(element, {
	relativeTo: otherElement,
	side: 'top',
	align: 'left',
	avoid: '.z',
	within: '.holder'
})
```

## Options

| Parameter | Type | Default | Description |
|----|:---:|:----:|----|
| `relativeTo` | _string_ / _element_ / _window_ / _rectangle_ | `window` | An area to align element relative to |
| `side` | _string_ | `undefined` | The side to place element: 'center', 'top', 'left', 'bottom', 'right' |
| `align` | _number_ | `'left'` | All possible values of [aligner](http://github.com/dfcreative/aligner/) |
| `within` | _string_ / _element_ / _window_ / _rectangle_ | `window` | Restriction area |
| `findBestSide` | _false_ / _true_ | `true` | Find the most appropiate side for the placement |
| `avoid` | _string_ / _element_ / _window_ / _rectangle_ | `undefined` | The areas or elements to avoid during placing. PENDING |


[![NPM](https://nodei.co/npm/placer.png)](https://nodei.co/npm/placer/)