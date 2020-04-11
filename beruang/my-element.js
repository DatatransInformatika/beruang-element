import BeruangElement from './beruang-element.js';

class MyElement extends BeruangElement {
	static get property() {
		return {			
			sapa:{value:"Tuan"},
			myLabel:{value:"Abdul", observer:"_labelChanged", attribute:true},
			cls:{value:"inp"},
			orang:{
				value:{nama:'Cicit',hobby:'Gitar'},
				type:Object
			},
			show:{
				value:false,
				type:Boolean
			},
			grup: {
				value: [
				{nama:'Abdul Yadi', umur:50},
				{nama:'Citra Larasati', umur:23}
				],
				type:Array
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
<template if="[[show]]">
	<div>[[sapa]]</div>
	<template if="[[show]]">
		<div>[[myLabel]]</div>
	</template>
</template>
<h1>[[decorate(sapa, orang.hobby, orang.nama)]]</h1>
<h2>Hello2 [[sapa]] [[orang.nama]] [[orang.hobby]] ya!</h2>
<div>[[myLabel]]</div>
<input id="inp1" class="inp" type="text" id="fname1" name="fname1" value="[[upper(myLabel)]]">
<input id="inp2" class$="[[cls]]" type="text" id="fname2" name="fname2" value="[[myLabel]]">
<input id="inp3" class="inp" type="text" id="fname2" name="fname2" value="[[orang.nama:change]]"> <!-- two-way on change-event -->
<template if="[[show]]"><div>[[sapa]]</div>
	<template if="[[show]]">
		<div>[[orang.nama]]</div>
	</template>
</template>
<template id="checkeach" each="[[grup]]" as="g">
	<div>[[g.nama]]</div>
</template>
</div>
`;
	}
	
	static get observers() {
		return ['_sapaLabelChanged(sapa, myLabel)'];
	}
	
	decorate(s1, s2, s3) {
		return s1 + ' ' + s2.toUpperCase() + ' ' + s3;
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