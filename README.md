# Placer [![Code Climate](https://codeclimate.com/github/dfcreative/placer/badges/gpa.svg)](https://codeclimate.com/github/dfcreative/placer) [![Dependencies](https://david-dm.org/dfcreative/color-ranger.svg)](https://david-dm.org/dfcreative/color-ranger")

Place any two DOM elements in a way you like. Mainly needed for dropdowns, tooltips, modals, notifiers and any kind of overlays.

[Demo & tests](https://dfcreative.github.io/placer)


## Usage

[![npm install placer](https://nodei.co/npm/placer.png?mini=true)](https://npmjs.org/package/placer/)


```js
var place = require('placer');

place(element, {
	target: otherElement,
	side: 'top',
	align: 'left',
	within: '.holder'
})
```

## Options

| Parameter | Default | Description |
|----|:---:|:----:|----|
| `target` | `window` | An area to align element relative to. |
| `side` | `undefined` | The side to place element: 'center', 'top', 'left', 'bottom', 'right'. |
| `align` | `'left'` | Alignment, 0..1 or one of the sides keywords. |
| `within` | `window` | Restriction area. |
| `auto` | `true` | Find the most appropiate side for the placement. |