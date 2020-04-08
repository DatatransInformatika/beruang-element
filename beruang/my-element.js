import BeruangElement from './beruang-element.js';

class MyElement extends BeruangElement {
	static get property() {
		return {			
			sapa:{value:"Tuan"},
			label:{value:"Abdul", observer:"_labelChanged", attribute:true},
			cls:{value:"inp"},
			orang:{
				value:{nama:'Cicit',hobby:'Gitar'},
				type:Object
			},
			show:{
				value:false,
				type:Boolean
			}
		};
	}

	static get template() {
		return `
<style>
:host h1 {color:red}
:host .inp {color:green}
</style>
<div>
<template if="[[show]]"><div>[[sapa]]</div></template>
<h1>[[decorate(sapa, orang.hobby,orang.nama)]]</h1>
<h2>Hello2 [[sapa]] [[orang.nama]] [[orang.hobby]] ya!</h2>
<div>[[label]]</div>
<input id="inp1" class="inp" type="text" id="fname1" name="fname1" value="[[upper(label)]]">
<input id="inp2" class$="[[cls]]" type="text" id="fname2" name="fname2" value="[[label]]">
<input id="inp3" class="inp" type="text" id="fname2" name="fname2" value="[[label:change]]"> <!-- two-way on change-event -->
<template if="[[show]]"><div>[[sapa]]</div></template>
</div>
`;
	}
	
	static get observers() {
		return ['_sapaLabelChanged(sapa, label)'];
	}
	
	decorate(sapa, label, num) {
		return sapa + ' ' + label.toUpperCase() + ' ' + num;
	}
	
	upper(name) {
		return name.toUpperCase();
	}
	
	_labelChanged(newValue, oldValue) {
		console.log(newValue, oldValue);
	}
	
	_sapaLabelChanged(sapa, label) {
		console.log('_sapaLabelChanged', sapa, label);
	}
}

window.customElements.define('my-element', MyElement);