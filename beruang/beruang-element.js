class BeruangElement extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({mode:'open'});
		this._prop = {};
		this._propClsMap = {};/*property to class map, a property map to array of class*/
		this._clsTextMap = {};/*class to function map {fmt:.., params:[{token:..,prop:..}], fname:...}*/
		this._clsAttMap = {};/*class to function map {<att>:{params:[{token:..,prop:..}], fname:..., event:...}}*/
		this._observerPropsMap = {};//{func:[array of properties]}
		this._propObserversMap = {};//{prop:[array of observer functions]}
		this._excludedRedrawClasses = [];//array contains class should not be redrawed
		this._initProp();
		this._initObserver();
	}

	connectedCallback() {
		let t = this.constructor.template;
		if(!!t) {
			let div = document.createElement('div');		
			div.innerHTML = t.trim();			
			this._initTemplate(div);
			let c;
			while( !!(c = div.firstChild) ) {
				this.shadowRoot.appendChild(c);
			}
			div = null;
			let cls = this.tagName.toLowerCase();
			let redrawClasses = [];			
			//this._propClsMapInit(this.shadowRoot, cls, redrawClasses);
			this._propClsMapInit(this.shadowRoot.firstElementChild, cls, redrawClasses);
			for(let i=0, n=redrawClasses.length; i<n; i++) {
				this._redrawClass(redrawClasses[i]);
			}			
		}
	}
	
	static get template() {
		return null;
	}
	
	static get observers() {
		return null;
	}
	
	_initProp() {
		let prop = this.constructor.property || {};
		for(let pn in prop) {
			let _p = {
				'value':this.hasAttribute(pn) ? this.getAttribute(pn) : prop[pn].value,
				'type':prop[pn].type,
				'attribute':!!prop[pn].attribute
			};
			let obs = prop[pn].observer;
			if(!!this[obs]){
				_p.observer = obs;
			}
			this._prop[pn] = _p;		
			Object.defineProperty(this, pn, {
				get: function () { 
                    return this._prop[pn].attribute ? this.getAttribute(pn) : this._prop[pn].value;
                },
                set: function (newValue) {
					let oldValue = this[pn];
					let changed = oldValue!==newValue;						
					if(this._prop[pn].attribute) {
						this.setAttribute(pn, newValue);
					} else {
						this._prop[pn].value = newValue;
					}					
					if(changed) {
					////update elements
						this._updateNode(pn);					
					////dedicated observer for the property	
						let obs = this._prop[pn].observer;
						if(!!obs) {
							this[obs].apply(null, [newValue, oldValue]);
						}
					////common observer for one or more properties
						let observers = this._propObserversMap[pn] || [];						
						for(let i=0,n=observers.length;i<n;i++) {
							let f = observers[i];							
							let props = this._observerPropsMap[f];							
							let arr=[];
							for(let j=0,m=props.length;j<m;j++){
								arr.push(this[props[j]]);
							}
							this[f].apply(null, arr);
						}
					}
                }
            });				
		}//for(let pn in prop)	
	}
	
	_initObserver() {
		let obvs = this.constructor.observers || [];
		for(let i=0, n=obvs.length; i<n; i++) {
			let o = obvs[i];
			if(/^\s*\S+\s*[(][^(]+[)]\s*$/g.test(o)){
				let fn = this._funcName(o);
				if(!!this[fn]){
					let isAllProp = true;
					let fargs = this._funcArgs(o);
					if(fargs.length>0) {
						for(let i=0,n=fargs.length;i<n;i++){//all observer argument must be registered properties
							if(!this._prop.hasOwnProperty(fargs[i])){
								isAllProp = false;
								break;
							}
						}						
					}//if(fargs.length>0) {
					if(isAllProp){
						if(!!!this._observerPropsMap[fn]){//ensure uniqueness
							this._observerPropsMap[fn]=fargs;
						}
						for(let i=0,n=fargs.length;i<n;i++){
							let prop = fargs[i];
							let arr = this._propObserversMap[prop];
							if(!!!arr) {
								arr = [];
								this._propObserversMap[prop] = arr;
							}
							if(arr.indexOf(fn)==-1){
								arr.push(fn);
							}
						}//for(let i=0,n=fargs.length;i<n;i++){
					}//if(isAllProp){
				}//if(!!this[fn]){
			}//if(/^\s*\S+\s*[(][^(]+[)]\s*$/g.test(o)){
		}//for(let i=0, n=obvs.length; i<n; i++) {	
	}
	
	_initTemplate(ele) {
		let el = ele.firstElementChild;
		while(el) {
			let tag = el.tagName.toLowerCase();
			if(tag==='template') {
				let clone = document.importNode(el.content, true);
				let o = el.parentNode.insertBefore(clone, el.nextElementSibling);
			} else {
				this._initTemplate(el);
			}
			el = el.nextElementSibling;
		}
	}

	_updateNode(pn) {
		let classes = this._propClsMap[pn];
		for(let i=0, n=!!classes ? classes.length : 0; i<n; i++) {
			this._redrawClass(classes[i]);
		}		
	}

	_propClsMapInit(ele, cls, redrawClasses) {
		let clsnum = 0;
		while(!!ele) {
			if(ele.tagName.toLowerCase()!=='style') {
				let clz = cls + '-' + (++clsnum);
				ele.classList.add(clz);
				this._propClsMapInitDo(ele, clz, redrawClasses);
				this._propClsMapInit(ele.firstElementChild, clz, redrawClasses);			
			}		
			ele = ele.nextElementSibling;
		}
	}
	
	_propClsMapInitDo(ele, cls, redrawClasses) {
		let atts = [];
		for (let i=0, attobjs=ele.attributes, n=attobjs.length; i<n; i++){
			let att = attobjs[i].nodeName;
			let s = ele.getAttribute(att);
			if( /^\s*[\[]{2}[^\[]+[\]]{2}\s*$/g.test(s) ) {
				atts.push(att);
			}
		}		
		let text = ele.firstChild ? ele.firstChild.textContent : '';
		if(atts.length===0 && text.length===0){
			return;
		}		
		let redraw = false;
		for(let pn in this._prop) {
			let propNames = [];			
			let attmatch = atts.length>0 ? this._propClsMapInitDoAttr(ele, atts, pn, cls, propNames) : false;
			let textmatch = text.length>0 ? this._propClsMapInitDoText(text, pn, cls, propNames) : false;			
			if(attmatch || textmatch) {
				for(let i=0, n=propNames.length; i<n; i++){
					let s = propNames[i];
					let clazzez = this._propClsMap[s];
					if(!!!clazzez) {
						clazzez = [];
						this._propClsMap[s] = clazzez;
					}
					if(clazzez.indexOf(cls)<0){
						clazzez.push(cls);
					}
				}					
				redraw=true;
			}
		}//for(let pn in this._prop) {			
		if(redraw) {
			redrawClasses.push(cls);
		}
		ele.removeAttribute('class$');
	}	
	
	_propClsMapInitDoAttr(ele, atts, pn, cls, propNames) {
		let attmatch = false;
		for (let i=0, n=atts.length; i<n; i++){
			let att = atts[i];
			let s = ele.getAttribute(att);
			let events = s.match(/([:][^\]]+)/g);
			let event = null;
			if(!!events && events.length>0) {
				event = events[0].replace(/^[:]/,'');
				s = s.replace(/([:][^\]]+)/g,'');
			}
			let mtch = this._propOrFuncMatch(pn, s);	
			if(mtch.propMatch || mtch.funcMatch) {//match form of [[property]] or [[func(property)]]
				attmatch = true;
				let cam = this._clsAttMap[cls];
				if(!!!cam) {
					cam = [];
					this._clsAttMap[cls] = cam;
				}
				if(!cam.hasOwnProperty(att)) {								
 					let obj = {}; //{'att':att};//{att:.., params:[{token:...,prop:...}], fname:..., event:...}
 					let params = []; //{token:s,prop:p}
 					if(mtch.propMatch) {//propety, not a function
 						this._propInit(s, params, propNames);
						if(!!event && event.length>0){
							obj['event'] = event;
						}
 					} else {//a function								
 						this._funcInit(s, params, propNames, obj);							
 					}
 					obj['params'] = params;
					cam[att] = obj;
 				}
			}//if(mtch.propMatch || mtch.funcMatch) {//match form of [[property]] or func(property)
		}//for (let i=0, n=atts.length; i<n; i++){	
		return attmatch;
	}
	
	_propClsMapInitDoText(text, pn, cls, propNames) {
		let textmatch = false;
		let mtch = this._propOrFuncMatch(pn, text);					
		if(mtch.propMatch || mtch.funcMatch) {//match form of [[property]] or func(property)						
			textmatch = true;
			if( !this._clsTextMap.hasOwnProperty(cls) ) {
				let obj = {'fmt':text};//{fmt:.., params, fname:...}
				let params = []; //{token:s,prop:p}
				if(mtch.propMatch) {//propety, not a function							
					this._propInit(text, params, propNames);
				} else {//a function
					this._funcInit(text, params, propNames, obj);							
				}
				obj['params'] = params;
				this._clsTextMap[cls]=obj;
			}//if( !this._clsTextMap.hasOwnProperty(cls) ) {								
		}//if(mtch.propMatch || mtch.funcMatch) {//match form of [[property]] or func(property)
		return textmatch;
	}
	
	_removeSquareBrackets(s, trim) {
		return trim ? s.replace(/\s*\[{2}|\]{2}\s*/g, '') : s.replace(/\[{2}|\]{2}/g,'');
	}
	
	_propOrFuncMatch(pn, s){
		let re = new RegExp('\\s*[\\[]{2}' + pn + '([.]\\S+)*[\\]]{2}\\s*', 'g');//[[property]] may multiple
		let propMatch = re.test(s);
		let funcMatch = false;
		if(!propMatch) {
			re = new RegExp('^\\s*[\\[]{2}\\S+[(](.+,\\s*)*' + pn + '(\\s*,.+)*[)][\\]]{2}\\s*$');//[[function(..,property,...)]] only one
			funcMatch = re.test(s);
		}
		re = null;
		return {
			'propMatch':propMatch,
			'funcMatch':funcMatch
		};
	}
	
	_pushPropNames(props, propNames) {
		let p = '';
		for(let i=0, n=props.length; i<n; i++) {
			p += (i>0 ? '.' : '') + props[i];
			propNames.push(p);
		}	
	}
	
	_propInit(s, params, propNames) {
		let arr = s.match(/[\[]{2}[^\[]+[\]]{2}/g);
		for(let i=0, n=arr.length; i<n; i++){
			let token = arr[i];
			let prop = this._removeSquareBrackets(token, false);
			let props = prop.split(/[.]/g);/*object and its properties path: obj.prop1.prop2...*/
			if(this._prop.hasOwnProperty(props[0])) {
				if(props.length===1 || this._prop[props[0]].type===Object/*props.length>1 must be Object*/) {
					params.push({'token':token, 'prop':prop});
					this._pushPropNames(props, propNames);
				}
			}
		}	
	}
	
	_funcName(s) {
		return s.match(/([a-zA-Z_{1}][a-zA-Z0-9_]+)(?=\()/g)[0];//get function name
	}
	
	_funcArgs(s) {
		let arr = null;
		let t = /\(\s*([^)]+?)\s*\)/.exec(s);
		if(!!t && t.length>0) {
			arr = t[1].split(/\s*,\s*/);
		}
		return arr || [];
	}
	
	_funcInit(s, params, propNames, obj) {
		let f = this._removeSquareBrackets(s, true);
		obj.fname = this._funcName(f);//get function name
		let arr = this._funcArgs(f);//get function arguments
		for(let i=0, n=arr.length; i<n; i++) {
			let prop = arr[i];
			if(prop.length>0){
				let props = prop.split(/[.]/g);/*object and its properties path: obj.prop1.prop2...*/
				let isProp = false;
				if(this._prop.hasOwnProperty(props[0])) {
					isProp = props.length===1 || this._prop[props[0]].type===Object/*props.length>1 must be Object*/;
				}											
				let obj = {};
				if(isProp) {
					obj.token = prop;
					obj.prop = prop;
					this._pushPropNames(props, propNames);
				} else {
				////trim singlequote or doublequote
					if(/^'|'$/g.test(prop)){
						prop = prop.replace(/^'|'$/g, '');
					} else if(/^"|"$/g.test(prop)) {
						prop = prop.replace(/^"|"$/g, '');
					}											
					obj.token = prop;	
				}
				params.push(obj);
			}//if(prop.length>0){
		}//for(let i=0;i<arr.length;i++) {
	}
		
	_propValue(prop) {
		let props = prop.split(/[.]/g);
		let val;
		if(props.length>1){
			val = this[props[0]];
			for(let i=1, n=props.length; i<n; i++) {
				val = val[props[i]];
			}
		} else {
			val = this[props[0]];
		}
		return val;	
	}
		
	_redrawClass(cls) {
		if(this._excludedRedrawClasses.indexOf(cls)>-1) {
			return;
		}	
		let el = this.shadowRoot.querySelector('.' + cls);//assumption: unique element with class
		if(!!!el) {
			return;
		}
		let cam = this._clsAttMap[cls];
		if(!!cam) {
			this._redrawClassAttr(cam, el, cls);
		}				
		let cfm = this._clsTextMap[cls];
		if(!!cfm) {
			this._redrawClassText(cfm, el);
		}
	}
	
	_redrawClassAttr(cam, el, cls) {
		for(let att in cam) {
			let obj = cam[att];				
			let val = null;
			let _el = null;
			if(!!obj.fname) {//a function
				_el = el;
				let arr = [];
				for(let i=0, n=!!obj.params ? obj.params.length : 0; i<n; i++){
					let param = obj.params[i];						
					if(!!param.prop) {
						arr.push(this._propValue(param.prop));
					} else {
						arr.push(param.token);
					}
				}						
				val = this[obj.fname].apply(null, arr);						
			} else {//not a function
				if(!!obj.params && obj.params.length>0) {
					_el = el;
					let prop = obj.params[0].prop;
					val = this._propValue(prop);
				////two way binding:
					if(!!obj.event) {
						if(!!!el.beruangevent) {
							el.beruangevent = true;
							el.addEventListener(obj.event, ()=>{
								let idx = this._excludedRedrawClasses.indexOf(cls);
								if( idx==-1 ){
									this._excludedRedrawClasses.push(cls);
								}
								this[prop] = el[att];
								if( idx==-1 ){
									idx = this._excludedRedrawClasses.indexOf(cls);
									if(idx>-1) {
										this._excludedRedrawClasses.splice(idx, 1); 
									}
								}
							});
						}
					}							
				}
			}
			if(!!_el) {
				if(att==='class$') {
					if(!!_el.beruangoldcls) {
						_el.classList.remove(_el.beruangoldcls);
					}
					_el.classList.add(val);
					_el.beruangoldcls = val;
				} else {
					_el[att] = val;							
				}
			}		
		}//for(let att in cam)	
	}
	
	_redrawClassText(cfm, el) {
		let fmt = cfm.fmt;
		if(!!cfm.fname) {//a function
			let arr = [];
			for(let i=0, n=!!cfm.params ? cfm.params.length : 0; i<n; i++){
				let param = cfm.params[i];						
				if(!!param.prop) {
					arr.push(this._propValue(param.prop));
				} else {
					arr.push(param.token);
				}
			}
			fmt = this[cfm.fname].apply(null, arr);
		} else {//not a function
			for(let i=0, n=!!cfm.params ? cfm.params.length : 0; i<n; i++){
				let param = cfm.params[i];
				fmt = fmt.replace(param.token, this._propValue(param.prop));					
			}
		}
		el.innerHTML = fmt;
	}
}

export default BeruangElement;