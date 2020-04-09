class BeruangElement extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({mode:'open'});
		this._prop = {};
		this._propClsMap = {};/*property to class map, a property map to array of class {<prop>:[cls, cls, cls]}*/
		this._clsTextMap = {};/*class to element text processing map {<cls>:{fmt:.., params:[{token:..,prop:..}], fname:...}}*/
		this._clsAttMap = {};/*class to element tag attribute processing map {<cls>:{<att>:{params:[{token:..,prop:..}], fname:..., event:...}}}*/
		this._clsIfMap = {};/*class to if template map {<cls>:{props:[...], fname:...}}*/
		this._clsEachMap = {};/*class to each template map {<cls>:{props:[...], fname:...}}*/
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
			let c;
			while( !!(c = div.firstChild) ) {
				this.shadowRoot.appendChild(c);
			}
			div = null;
			let cls = this.nodeName.toLowerCase();						
			let redrawClasses = [];			
			this._propClsMapInit(this.shadowRoot.firstElementChild, cls, redrawClasses, null);
			for(let i=0, n=redrawClasses.length; i<n; i++) {
				this._renderClass(redrawClasses[i]);
			}						
		}
	}
	
	static get template() {
		return null;
	}
	
	static get observers() {
		return null;
	}
	
	_removeClassesFromMaps(clss) {
		for(let i=0,n=!!clss ? clss.length : 0;i<n;i++){
			let cls = clss[i];
			for(let pn in this._propClsMap) {
				let arr = this._propClsMap[pn];
 				let idx = arr.indexOf(cls);
				if(idx>-1){
					arr.splice(idx,1);
				}
			}				
			delete this._clsTextMap[cls];
			delete this._clsAttMap[cls];
			delete this._clsIfMap[cls];
			delete this._clsEachMap[cls];			
		}
	}
	
	_initProp() {
		let prop = this.constructor.property || {};
		for(let pn in prop) {
			let _typ = prop[pn].hasOwnProperty('type') ? prop[pn].type : String;
			let _val;
			let attr = this._camelize(pn);
			if(this.hasAttribute(attr)){
				_val = this.getAttribute(attr);
				if(_typ===Boolean && (_val===undefined || _val===null || _val==='')){
					_val = true;
				}
			} else {
				if(prop[pn].hasOwnProperty('value')){
					_val = prop[pn].value;
				} else {
					if(_typ===Boolean){
						_val = true;
					}
				}
			}
			let _p = {
				'value':_val,
				'type':_typ,
				'attribute':!!prop[pn].attribute
			};
			let obs = prop[pn].observer;
			if(!!this[obs]){
				_p.observer = obs;
			}
			this._prop[pn] = _p;		
			Object.defineProperty(this, pn, {
				get: function () { 
                    return this._prop[pn].attribute ? this.getAttribute(this._decamelize(pn)) : this._prop[pn].value;
                },
                set: function (newValue) {
					let oldValue = this[pn];
					let changed = oldValue!==newValue;						
					if(this._prop[pn].attribute) {
						this.setAttribute(this._decamelize(pn), newValue);
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
	
	_camelize(str) {
		return str.replace(/^([A-Z])|[\s-_]+(\w)/g, function(match, p1, p2, offset) {
			if (p2) return p2.toUpperCase();
			return p1.toLowerCase();        
		});
	}
	
	_decamelize(str){
		return str
			.replace(/([a-z\d])([A-Z])/g, '$1' + '-' + '$2')
			.replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1' + '-' + '$2')
			.toLowerCase();
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
	
	_updateNode(pn) {
		let classes = this._propClsMap[pn];
		for(let i=0, n=!!classes ? classes.length : 0; i<n; i++) {
			this._renderClass(classes[i]);
		}		
	}

	_propClsMapInit(ele, cls, redrawClasses, beforeEl) {
		let clsnum = 0;
		while(!!ele) {
			if(ele===beforeEl) {
				break;
			}
			if(ele.nodeName.toLowerCase()!=='style') {
				let clz = cls + '-' + (++clsnum);
				ele.classList.add(clz);
				ele.beruangcls=clz;
				this._propClsMapInitDo(ele, clz, redrawClasses, beforeEl);
				this._propClsMapInit(ele.firstElementChild, clz, redrawClasses);			
			}		
			ele = ele.nextElementSibling;
		}
	}
	
	_propClsMapInitDo(ele, cls, redrawClasses) {
		let atts = [];
				
		let text;
		let tmplMap;//pointer to this._clsIfMap or this._clsEachMap
		let tmplText;
		if(ele.nodeName.toLowerCase()==='template') {
			let re = new RegExp('^\\s*!{0,1}[\\[]{2}[^\\[]+[\\]]{2}\\s*$', 'g');
			let o = {'if':this._clsIfMap, 'each':this._clsEachMap};
			for(let t in o){
				if(ele.hasAttribute(t)){
					tmplText = ele.getAttribute(t);
					if(re.test(tmplText)) {
						tmplMap=o[t];
					}
					break;
				}
			}
			if(!!!tmplMap){
				return;
			}
			re=null;
		} else {
			let re = new RegExp('^\\s*[\\[]{2}[^\\[]+[\\]]{2}\\s*$', 'g');
			for (let i=0, attrs=ele.attributes, n=attrs.length; i<n; i++){
				let att = attrs[i].nodeName;
				let s = ele.getAttribute(att);
				if(re.test(s)) {
					atts.push(att);
				}
			}	
			re=null;
			text = ele.firstChild ? ele.firstChild.textContent : '';
			if(atts.length===0 && text.length===0){
				return;
			}
		}
				
		let redraw = false;
		for(let pn in this._prop) {
			let propNames = [];
			let tagmatch = !!tmplMap ? this._propClsMapInitDoTmpl(ele, tmplMap, tmplText, pn, cls, propNames) : false; 
			let attmatch = !!!tmplMap && atts.length>0 ? this._propClsMapInitDoAttr(ele, atts, pn, cls, propNames) : false;
			let textmatch = !!!tmplMap && text.length>0 ? this._propClsMapInitDoText(text, pn, cls, propNames) : false;			
			if(tagmatch || attmatch || textmatch) {
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
	
	_propClsMapInitDoTmpl(ele, tmplMap, text, pn, cls, propNames) {
		//tmplMap:class to if template map {<cls>:{props:[...], fname:...}}
		let re = new RegExp('^\\s*[!]');
		ele.beruangtmplnegate = re.test(text);
		if(ele.beruangtmplnegate){
			text = text.replace(re, '');
		}		
		re = null;
		let mtch = this._propOrFuncMatch(pn, text);
		if(mtch.propMatch || mtch.funcMatch) {//match form of [[property]] or [[func(property)]]
			let obj = tmplMap[cls];
			if(!!!obj) {
				obj = {};
				let params = [];//{token:s,prop:p}
				if(mtch.propMatch) {//propety, not a function
					this._propInit(text, params, propNames);				
				} else {//a function
					this._funcInit(text, params, propNames, obj);
				}	
				obj['params'] = params;			
				tmplMap[cls] = obj;				
			}
			return true;
		}
		return false;
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
					cam = {};
					this._clsAttMap[cls] = cam;
				}
				if(!cam.hasOwnProperty(att)) {
 					let obj = {}; //<att>:{params:[{token:...,prop:...}], fname:..., event:...}
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
	
	_objPropPathToPropNames(props, propNames) {
		let p = '';
		for(let i=0, n=props.length; i<n; i++) {
			p += (i>0 ? '.' : '') + props[i];
			propNames.push(p);
		}	
	}
	
	_objPropPathSplit(s) {/*object and its properties path: obj.prop1.prop2...*/
		return s.split(/[.]/g);
	}
	
	_objPropPathRef(props) {
		let rslt = {'depth':props.length, 'obj':this[props[0]], 'idx':null};
		let re = /^[1-9][0-9]*$/;
		for(let i=1, n=rslt.depth; rslt.obj!==undefined && rslt.obj!==null && i<n; i++) {
			let s = props[i];
			if(re.test(s)){
				s = parseInt(s);				
			}
			if(i<n-1){
				rslt.obj = rslt.obj[s];
			} else if(i==n-1){
				rslt.idx = s;
			}
		}
		re = null;
		return rslt;
	}
	
	_propInit(s, params, propNames) {
		let arr = s.match(/[\[]{2}[^\[]+[\]]{2}/g);
		for(let i=0, n=arr.length; i<n; i++){
			let token = arr[i];
			let prop = this._removeSquareBrackets(token, false);
			let props = this._objPropPathSplit(prop);
			if(this._prop.hasOwnProperty(props[0])) {
				if(props.length===1/*primitive type*/ || this._prop[props[0]].type===Object/*object*/) {
					params.push({'token':token, 'prop':prop});
					this._objPropPathToPropNames(props, propNames);
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
				let props = this._objPropPathSplit(prop);
				let isProp = false;
				if(this._prop.hasOwnProperty(props[0])) {
					isProp = props.length===1 || this._prop[props[0]].type===Object/*props.length>1 must be Object*/;
				}											
				let o = {};
				if(isProp) {
					o.token = prop;
					o.prop = prop;
					this._objPropPathToPropNames(props, propNames);
				} else {
				////trim singlequote or doublequote
					if(/^'|'$/g.test(prop)){
						prop = prop.replace(/^'|'$/g, '');
					} else if(/^"|"$/g.test(prop)) {
						prop = prop.replace(/^"|"$/g, '');
					}											
					o.token = prop;	
				}
				params.push(o);
			}//if(prop.length>0){
		}//for(let i=0;i<arr.length;i++) {
	}
		
	_propValue(prop) {
		let arr = this._objPropPathSplit(prop);
		let rslt = this._objPropPathRef(arr);
		return rslt.depth===1 ? rslt.obj : (!!rslt.obj ? rslt.obj[rslt.idx] : null);
	}
				
	_renderClass(cls) {
		if(this._excludedRedrawClasses.indexOf(cls)>-1) {
			return;
		}	
		let el = this.shadowRoot.querySelector('.' + cls);//assumption: unique element with class
		if(!!!el) {
			return;
		}
		let ctm = this._clsIfMap[cls];
		if(!!ctm){			
			this._renderClassIf(ctm, el);
			return;//if template then exit immediately
		}		
		let cam = this._clsAttMap[cls];
		if(!!cam) {
			this._renderClassAttr(cam, el, cls);
		}				
		let cfm = this._clsTextMap[cls];
		if(!!cfm) {
			this._renderClassText(cfm, el);
		}
	}
	
	_renderClassIf(obj, el) {
		let rslt = this._renderClassAttrValue(obj, el, null, null);
		if(!!!rslt.el) {
			return;
		}
		let show = el.beruangtmplnegate ? !!!rslt.val : !!rslt.val;
		if(show) {
			let tmplparenthidden=false;
			let tmplparent;
			let t = el;
			while( !!(tmplparent = t.beruangtmplparent) ) {
				if(!tmplparent.beruangtmplshown){
					tmplparenthidden=true;
					break;
				}
				t = tmplparent;
			}
			if(!tmplparenthidden){						
				el.beruangtmplshown=true;
				let sibling = el.previousElementSibling;
				let clone = document.importNode(el.content, true);
				el.parentNode.insertBefore(clone, el);
				el.beruangtmplchildren = [];
				let elstart = !!sibling ? sibling.nextElementSibling : el.parentNode.firstElementChild;
				let elrun = elstart;
				while(!!elrun && elrun!==el) {
					el.beruangtmplchildren.push(elrun);
					elrun.beruangtmplparent=el;
					elrun = elrun.nextElementSibling;
				}					
				let redrawClasses = [];
				this._propClsMapInit(elstart, el.beruangcls, redrawClasses, el);
				for(let i=0, n=redrawClasses.length; i<n; i++) {
					this._renderClass(redrawClasses[i]);
				}
			}
		} else {
			this._tmplHide(el);
		}
	}
	
	_tmplHide(el) {
		if(!!el.beruangtmplshown){			
			for(let i=0,n=!!el.beruangtmplchildren ? el.beruangtmplchildren.length : 0; i<n; i++){
				this._tmplHide(el.beruangtmplchildren[i]);
			}		
			el.beruangtmplshown=false;
			let clss = [];
			for(let i=0,n=!!el.beruangtmplchildren ? el.beruangtmplchildren.length : 0; i<n; i++){
				let e = el.beruangtmplchildren[i];
				delete e.beruangtmplparent;
				clss.push(e.beruangcls);
				if(!!e.parentNode){
					e.parentNode.removeChild(e);
				}
			}
			delete el.beruangtmplchildren;
			this._removeClassesFromMaps(clss);
		}		
	}
	
	_renderClassAttr(cam, el, cls) {
		for(let att in cam) {
			let obj = cam[att];				
			let rslt = this._renderClassAttrValue(obj, el, cls, att);
			if(!!rslt.el) {
				if(att==='class$') {
					if(!!rslt.el.beruangoldcls) {
						rslt.el.classList.remove(rslt.el.beruangcls);
					}
					rslt.el.classList.add(rslt.val);
					rslt.el.beruangoldcls = rslt.val;
				} else {
					rslt.el[att] = rslt.val;							
				}
			}		
		}//for(let att in cam)	
	}
	
	_renderClassAttrValue(obj, el, cls, att) {
		let rslt={'el':null,'val':null};
		if(!!obj.fname) {//a function
			rslt.el = el;
			let arr = [];
			for(let i=0, n=!!obj.params ? obj.params.length : 0; i<n; i++){
				let param = obj.params[i];						
				if(!!param.prop) {
					arr.push(this._propValue(param.prop));
				} else {
					arr.push(param.token);
				}
			}						
			rslt.val = this[obj.fname].apply(null, arr);						
		} else {//not a function
			if(!!obj.params && obj.params.length>0) {
				rslt.el = el;
				let prop = obj.params[0].prop;
				rslt.val = this._propValue(prop);
			////two way binding:
				if(!!obj.event) {
					if(!!!el.beruangevent) {
						el.beruangevent = true;
						el.addEventListener(obj.event, ()=>{
							let idx = this._excludedRedrawClasses.indexOf(cls);
							if( idx==-1 ){
								this._excludedRedrawClasses.push(cls);
							}
							let arr = this._objPropPathSplit(prop);
							let rslt = this._objPropPathRef(arr);
							if(rslt.depth===1){
								this[arr[0]] = el[att];
							} else {
								rslt.obj[rslt.idx] = el[att];
								this._updateNode(prop);
							}
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
		return rslt;
	}
	
	_renderClassText(cfm, el) {
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