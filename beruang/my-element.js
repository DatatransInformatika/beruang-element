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
<div>[[myLabel]]</div>
<div>[[upper(myLabel)]]</div>
<div>[[myLabel]] [[upper(myLabel)]]</div>
<div>[[myLabel]] [[upper(myLabel)]] check</div>
<div id='test'><span>[[myLabel]]</span> <span><b>and</b></span>  <span>[[upper(myLabel)]]</span></div>
<input id="inp1" class="inp" type="text" id="fname1" name="fname1" value="[[myLabel]]">
<input id="inp2" class="inp" type="text" id="fname2" name="fname2" value="[[upper(myLabel)]]">
<input id="inp3" class="inp" type="text" id="fname3" name="fname3" value="[[myLabel]] [[upper(myLabel)]]">
<input id="inp4" class="inp" type="text" id="fname4" name="fname4" value="[[myLabel]] and [[upper(myLabel)]]">
<input id="inp5" class="inp" type="text" id="fname5" name="fname5" value="[[myLabel:change]]">
<input id="inp6" class$="[[cls]]" type="text" id="fname5" name="fname6" value="ok [[sapa]] [[myLabel]]">
<template id="tmpl1" if="[[show]]"><div>show [[sapa]]</div></template>
<template id="tmpl1" if="![[show]]"><div>!show [[sapa]]</div></template>

<!--
<template if="[[show]]">
	<div>[[sapa]]</div>
	<template if="[[show]]">
		<div>[[myLabel]]</div>
	</template>
</template>
-->
<!--<h1>[[decorate(sapa, orang.hobby, orang.nama)]]</h1>
<h2>Hello2 [[sapa]] [[orang.nama]] [[orang.hobby]] ya!</h2>-->


<!--
<input id="inp1" class="inp" type="text" id="fname1" name="fname1" value="[[upper(myLabel)]]">
<input id="inp2" class$="[[cls]]" type="text" id="fname2" name="fname2" value="ok [[sapa]] [[myLabel]]">
<input id="inp3" class="inp" type="text" id="fname2" name="fname2" value="[[orang.nama:change]]">
<template if="[[show]]"><div>[[sapa]]</div>
	<template if="[[show]]">
		<div>[[orang.nama]]</div>
	</template>
</template>
<template id="checkeach" each="[[grup]]" as="g">
	<div>[[g.nama]] [[g.umur]]</div>
</template>
-->
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