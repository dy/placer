Places any element relative to any other element the way you define.

## Use

You need browserify or alike to use placer.

```js
npm install placer
```

```js
var place = require('placer');
place(document.querySelector('.x'), {
	relativeTo: '.y',
	side: 'top',
	align: 'left',
	avoid: '.z',
	within: '.holder'
})
```

## Options

| Parameter | Type | Default | Description |
|----|:---:|:----:|---:|
| `relativeTo` | _string_ / _element_ / _window_ / _rectangle_ | window | An area to align element relative to |
| `side` | _string_ | undefined | The side to place element: 'center', 'top', 'left', 'bottom', 'right' |
| `align` | _number_ | 0.5 | Alignment: 0..1, 'center', 'top', 'left', 'bottom', 'right' |
| `avoid` | _string_ / _element_ / _window_ / _rectangle_ | undefined | The areas or elements to avoid during placing |
| `within` | _string_ / _element_ / _window_ / _rectangle_ | window | Restriction area |


## License

MIT