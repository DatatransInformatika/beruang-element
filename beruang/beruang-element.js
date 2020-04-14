class BeruangElement extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({mode:'open'});
		this._prop = {};
		this._propClsMap = {};/*property to class map, a property map to array of class {<prop>:[cls, cls, cls]}*/		
	////class to element rendering config:BEGIN
		/*generic form:
			{<cls>:{
				<att>:{	fmt:..., 
						terms: [ //terms is a [[...]], an element may have multiple terms <literal> [[..]] <literal> [[..]] <literal>
							{	fmt:...,
								fname:...,
								event:..., //event for two-way binding
								params:[{prop:..., token:...}, {prop:..., token:...}]
							}
						]
					}
				}
			}*/
		this._clsTextMap = {};	
		/*for textelement:
		{<cls>:{
			"t":{	fmt:..., //mandatory
					terms: [
						{	fmt:...., //mandatory
							fname:..., //optional
							event:null, //null
							params:[{	prop:..., //only for registered property
										token:... //only for function argument which is non-registered property
									},...]
									//mandatory for non-function 
									//may be omitted for function with no arguments
						}
					]
				}
			}
		}*/
		this._clsAttMap = {};
		/*for attribute:
		{<cls>:{
			<att>:{	fmt:..., //mandatory
					terms: [
						{	fmt:...., //mandatory
							fname:..., //optional
							event:..., //optional
							params:[{	prop:... //only for registered property
										token:... //only for function argument which is non-registered property
								},...]
								//mandatory for non-function 
								//may be omitted for function with no arguments
						}
					]
				}
			}
		}*/
		this._clsIfMap = {};
		/*for if template:
		{<cls>:{
			"t":{	fmt:null, //null
					terms: [ //only first term is captured, discard others if any
						{	fmt:...., //mandatory
							fname:..., //optional, should evaluates to boolean
							event:null, //null
							params:[{	prop:... //only for registered property
										token:... //only for function argument which is non-registered property
								},...]
								//mandatory for non-function 
								//may be omitted for function with no arguments
								//if fname is valid than allow multiple param
								//otherwise only first param captured, should evaluates to boolean
						}
					]
				}
			}
		}*/				
		this._clsEachMap = {};
		/*for each template:
		{<cls>:{
			"t":{	fmt:null, //null 
					terms: [ //only first term is captured, discard others if any
						{	fmt:...., //mandatory
							fname:..., //optional, should evaluates to array
							event:null, //null
							params:[{	prop:... //only for registered property
										token:... //only for function argument which is non-registered property
								},...]
								//mandatory for non-function 
								//may be omitted for function with no arguments													
								//if fname is valid than allow multiple param
								//other wise only first param captured, should evaluates to array
						}
					]
				}
			}
		}*/		
	////class to element rendering config:END
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
			this._propClsMapCreate(this.shadowRoot.firstElementChild, cls, redrawClasses, null);			
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
		
/////initialization:BEGIN	
	_initProp() {
		let prop = this.constructor.property || {};
		for(let pn in prop) {
			let _typ = prop[pn].hasOwnProperty('type') ? prop[pn].type : String;
			let _val;
			let attr = this._camelize(pn);
			if(this.hasAttribute(attr)){
				_val = this.getAttribute(attr);
				if(_typ===Boolean){
					_val = (_val==='' || _val==='true') ? true : (_val==='false' ? false : !!_val);
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
						this._renderNode(pn);
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
			//if(/^\s*\S+\s*[(][^(]+[)]\s*$/g.test(o)){
			if(/^\s*\S+\s*[(][^(]+[)]\s*$/.test(o)){
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
/////initialization:END

/////class map config creation:BEGIN
	_propClsMapCreate(ele, cls, redrawClasses, beforeEl) {
		let clsnum = 0;
		while(!!ele) {
			if(ele===beforeEl) {
				break;
			}
			if(ele.nodeName.toLowerCase()!=='style') {
				let clz = cls + '-' + (++clsnum);
				ele.classList.add(clz);
				ele.beruangcls=clz;
				this._propClsMapCreateDo(ele, clz, redrawClasses, beforeEl);
				this._propClsMapCreate(ele.firstElementChild, clz, redrawClasses);			
			}		
			ele = ele.nextElementSibling;
		}
	}
	
	_propClsMapCreateDo(ele, cls, redrawClasses) {
		let atts = [];				
		let text;
		let tmplMap;//pointer to this._clsIfMap or this._clsEachMap
		let tmplText;
		if(ele.nodeName.toLowerCase()==='template') {
			if(ele.hasAttribute('if')){
				tmplText = ele.getAttribute('if');
				let re = /[!]{0,1}[\[]{2}[^\[]+[\]]{2}/; //g;
				if( re.test(tmplText) ){
					tmplText = (tmplText.match(re))[0];//only first term is captured, discard others if any
					tmplMap = this._clsIfMap;
				}
				re = null;
			} else if(ele.hasAttribute('each')){
				tmplText = ele.getAttribute('each');
				let re = /[\[]{2}[^\[]+[\]]{2}/; //g;
				if( re.test(ele.getAttribute(tmplText)) ){
					tmplText = (tmplText.match(re))[0];//only first term is captured, discard others if any
					tmplMap = this._clsEachMap;
				}
				re = null;			
			}
			if(!!!tmplMap){
				return;
			}			
		} else {
			let re = /[\[]{2}[^\[]+[\]]{2}/; //g;
			for (let i=0, attrs=ele.attributes, n=attrs.length; i<n; i++){
				let att = attrs[i].nodeName;
				let s = ele.getAttribute(att);
				if(re.test(s)) {
					atts.push(att);
				}
			}
			re=null;			
			text = ele.firstChild && ele.firstChild.nodeType===3 ? ele.textContent : '';
			if(atts.length===0 && text.length===0){
				return;
			}
		}

		let redraw = false;
		for(let pn in this._prop) {		
			let propNames = [];
			let tmplmatch = !!tmplMap ? this._propClsMapInitDoTmpl(ele, tmplMap, tmplText, pn, cls, propNames) : false; 
			let attmatch = !!!tmplMap && atts.length>0 ? this._propClsMapInitDoAttr(ele, atts, pn, cls, propNames) : false;
			let textmatch = !!!tmplMap && text.length>0 ? this._propClsMapInitDoText(text, pn, cls, propNames) : false;			
			if(tmplmatch || attmatch || textmatch) {
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
	
	_termMatch(text, pn, negation, propNames) { //break text into terms
		let refunc = new RegExp('[\\[]{2}\\S+[(](.+,\\s*)*' + pn + '(\\s*,.+)*[)][\\]]{2}');//function terms
		let reprop = new RegExp('[\\[]{2}' + pn + '([.]\\S+)*([:]\\S+){0,1}[\\]]{2}');//property terms		
		let mtch = refunc.test(text) || reprop.test(text);
		if(!mtch){
			return null;
		}		
		let terms = [];
		let re = negation ? /[!]{0,1}[\[]{2}[^\[]+[\]]{2}/g : /[\[]{2}[^\[]+[\]]{2}/g;//generic terms
		let arr = text.match(re);
		let format = text;
		re = null;		
		for(let i=0,n=arr.length;i<n;i++){
			let fmt = arr[i];
			let isfunc = refunc.test(fmt);
			let isprop = !isfunc && reprop.test(fmt);			
			if(!isfunc && !isprop){
				continue;
			}			
			let word = fmt;
			if(word.charAt(0)==='!'){
				word = word.slice(1);
			}
			word = word.replace(/^[\[]{2}|[\]]{2}$/g, '');//remove double brackets
			if(isfunc){				
			////is a function:BEGIN
				let args = this._funcArgs(word);
				let params = [];				
				for(let i=0,n=args.length; i<n; i++) {
					let prop = args[i];
					if(prop.length>0){
						let props = this._objPropPathSplit(prop);//break obj.path0.path1 into array [obj,path0,path1]
						let isProp = false;
						if(this._prop.hasOwnProperty(props[0])) {
							isProp = props.length===1
								|| this._prop[props[0]].type===Object || this._prop[props[0]].type===Array/*props.length>1 must be Object*/;
						}											
						let o = {};
						if(isProp) {
							o.prop = prop; //registered property
							this._objPropPathToPropNames(props, propNames);//store obj.path0.path1 into propNames
								//in order: obj=>propNames, obj.path0=>propNames, obj.path0.path1=>propNames
						} else {
						////remove singlequote or doublequote
							if(/^'|'$/g.test(prop)){
								prop = prop.replace(/^'|'$/g, '');
							} else if(/^"|"$/g.test(prop)) {
								prop = prop.replace(/^"|"$/g, '');
							}											
							o.token = prop;	//non-registered property
						}
						params.push(o);
					}//if(prop.length>0){
				}//for(let i=0,n=args.length; i<n; i++) {
				let term = {'fmt': fmt, 'fname':this._funcName(word)};
				if(params.length>0){
					term['params']=params;
				}
				terms.push(term);	
			////is a function:END
			} else {//isprop
			////is not a function:BEGIN
				let re = /[:]\S+$/;//event pattern
				let event = null;
				if(re.test(word)){//capture event
					let events = word.match(re);
					event = events[0].replace(/^[:]/,'');
					word = word.replace(re, '');
					format = '[[' + word + ']]';
					fmt = format;
				}
				re = null;				
				let props = this._objPropPathSplit(word);//break obj.path0.path1 into array [obj,path0,path1]
				let params=[];
				if(this._prop.hasOwnProperty(props[0])) {
					if(props.length===1/*primitive type*/ || this._prop[props[0]].type===Object || this._prop[props[0]].type===Array) {
						params.push({'prop':word});
						this._objPropPathToPropNames(props, propNames);//store obj.path0.path1 into propNames
							//in order: obj=>propNames, obj.path0=>propNames, obj.path0.path1=>propNames					
					}
				}				
				if(params.length>0){//non function must have params
					let term = {'fmt': fmt, 'params':params};
					if(!!event){
						term['event']=event;
					}
					terms.push(term);					
				}				
			////is not a function:END
			}
		}
		refunc = null;
		reprop = null;		
		return {'fmt':format, 'terms':terms};
	}
	
	_propClsMapInitDoTmpl(ele, tmplMap, text, pn, cls, propNames) {//"if" or "each" template
		if(tmplMap.hasOwnProperty(cls)){
			return false;
		}			
		let negation = tmplMap===this._clsIfMap;
		let terms = this._termMatch(text, pn, negation, propNames);
		if(terms.length==0){
			return false;
		}
		tmplMap[cls] = {'t':{'terms':terms}};
		if(tmplMap==this._clsEachMap) {
			ele.beruangtmpleach = {
				'as':ele.getAttribute('as') || 'item',
				'idx':ele.getAttribute('idx') || 'i'
			};			
		}		
		return true;
	}
	
	_propClsMapInitDoAttr(ele, atts, pn, cls, propNames) {
		let obj = this._clsAttMap[cls];
		let found = false;
		for(let i=0,n=atts.length;i<n;i++){
			let att = atts[i];			
			let fmt = ele.getAttribute(att);
			let d = this._termMatch(fmt, pn, false, propNames);			
			if(!!d){
				found = true;
				if(!!!obj){					
					obj = {};
					this._clsAttMap[cls] = obj;
				}
				let attObj = obj[att];
				if(!!!attObj){
					obj[att] = d;
				} else {
					for(let j=0,m=d.terms.length;j<m;j++){
						attObj.terms.push(d.terms[j]);
					}					
				}
			}
		}
		return found;
	}
	
	_propClsMapInitDoText(text, pn, cls, propNames) {
		if(this._clsTextMap.hasOwnProperty(cls)){
			return false;
		}
		let d = this._termMatch(text, pn, false, propNames);
		if(!!!d){
			return false;
		}		
		this._clsTextMap[cls] = {'t':d};
		return true;
	}
/////class map config creation:BEGIN	

////render:BEGIN	
	_renderNode(pn) {
		let classes = this._propClsMap[pn];		
		for(let i=0, n=!!classes ? classes.length : 0; i<n; i++) {
			this._renderClass(classes[i]);
		}		
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
		ctm = this._clsEachMap[cls];
		if(!!ctm){
			this._renderClassEach(ctm, el);
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
/*		let rslt = this._renderClassAttrValue(obj, el, null, null);
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
		}*/
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
	
	_renderClassEach(obj, el) {
/*		let rslt = this._renderClassAttrValue(obj, el, null, null);
		if(!!!rslt.el) {
			return;
		}
		let sibling = el.previousElementSibling;
		for(let i=0, n=rslt.val.length; i<n; i++){
			let clone = document.importNode(el.content, true);
			el.parentNode.insertBefore(clone, el);
		}
		el.beruangtmplchildren = [];
		let elstart = !!sibling ? sibling.nextElementSibling : el.parentNode.firstElementChild;
		let elrun = elstart;
		let i=0;
// 			ele.beruangtmpleach = {
// 				'as':ele.getAttribute('as') || 'item',
// 				'idx':ele.getAttribute('idx') || 'i'
// 			};
		let re = new RegExp('[\\[]{2}' + el.beruangtmpleach.as + '[.]', 'g');
		let prop = obj.params[0].prop;
		while(!!elrun && elrun!==el) {
			el.beruangtmplchildren.push(elrun);
			let t = elrun.firstChild ? elrun.firstChild.textContent : '';
			if(t.length>0){
//to do: handle function
				//elrun.firstChild.textContent = t.replace(re, '[[' + prop + '.' + (i++) + '.');
				elrun.firstChild.textContent = t.replace(re, '[[' + prop + '.' + (i++) + '.');				
			}
			elrun.beruangtmplparent=el;
			elrun = elrun.nextElementSibling;
		}
		re = null;					
		let redrawClasses = [];
		this._propClsMapInit(elstart, el.beruangcls, redrawClasses, el);
		for(let i=0, n=redrawClasses.length; i<n; i++) {
			this._renderClass(redrawClasses[i]);
		}*/
	}
	
	_renderClassAttr(cam, el, cls) {
		for(let att in cam) {
			let obj = cam[att];
			let val = this._renderClassAttrValue(obj, el, cls, att);
			if(att==='class$') {
				if(!!el.beruangoldcls) {
					el.classList.remove(el.beruangoldcls);
				}
				el.classList.add(val);
				el.beruangoldcls = val;
			} else {
				el[att] = val;							
			}			
		}//for(let att in cam)	
	}
	
	_renderClassAttrValue(obj, el, cls, att) {
		let fmt = obj.fmt;
		let terms = obj.terms;
		for(let i=0,n=terms.length;i<n;i++){
			let term = terms[i];
			fmt = this._solveTerm(term, fmt);
			if(	!!!term.fname && !!term.event /*two-way binding only for non-function*/
				&& !!!el.beruangevent/*ensure unique event listener*/){
				el.beruangevent = term.event;
				el.addEventListener(term.event, ()=>{
					let idx = this._excludedRedrawClasses.indexOf(cls);
					if( idx==-1 ){
						this._excludedRedrawClasses.push(cls);
					}
					let prop = term.params[0].prop;//params[0].prop;
					let arr = this._objPropPathSplit(prop);
					let ref = this._objPropPathRef(arr);
					ref.obj[ref.idx] = el[att];
					if(ref.obj!==this) {
						this._renderNode(prop);
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
		return fmt;
	}
	
	_renderClassText(cfm, el) {
		let obj = cfm['t'];
		let fmt = obj.fmt;
		let terms = obj.terms;
		for(let i=0,n=terms.length;i<n;i++){
			fmt = this._solveTerm(terms[i], fmt);			
		}
		el.innerHTML = fmt;
	}
	
	_solveTerm(term, fmt){
		let s;
		let params = term.params;
		if(!!term.fname){//a function
			let arr = [];				
			for(let j=0,m=params.length;j<m;j++){
				let param = params[j];
				if(param.hasOwnProperty('prop')){
					arr.push(this._propValue(param.prop));
				} else {
					arr.push(param.token);
				}
			}
			s = this[term.fname].apply(null, arr);		
		} else {//not a function
			s = this._propValue(params[0].prop);
		}
		return fmt.replace(term.fmt, s);	
	}
////render:END

/////helper:BEGIN
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
	
	_propValue(prop) {
		let arr = this._objPropPathSplit(prop);
		return this._objPropPathRef(arr).val;
	}
	
	_objPropPathSplit(s) {/*object and its properties path: obj.prop1.prop2...*/
		return s.split(/[.]/g);
	}

	_objPropPathRef(props) {
		let len = props.length;
		let p0 = props[0];
		let rslt = {'obj':(len===1 ? this : this[p0]), 'idx':(len===1 ? p0 : null), 'val':(len===1? this[p0] : null)};
		let re = /^[1-9][0-9]*$/;
		for(let i=1; rslt.obj!==undefined && rslt.obj!==null && i<len; i++) {
			let s = props[i];
			if(re.test(s)){
				s = parseInt(s);				
			}
			if(i<len-1){
				rslt['obj'] = rslt.obj[s];
			} else if(i==len-1){
				rslt['idx'] = s;
				rslt['val'] = rslt.obj[s];
			}
		}
		re = null;
		return rslt;
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
	
	_funcName(s) {
		return s.match(/([a-zA-Z_{1}][a-zA-Z0-9_]+)(?=\()/g)[0];//get function name
	}
	
	_funcArgs(s) {
		let arr = null;
		let t = s.match(/\(\s*([^)]+?)\s*\)/);
		if(!!t && t.length>0) {
			arr = t[1].split(/\s*,\s*/);
		}
		return arr || [];
	}
	
	_objPropPathToPropNames(props, propNames) {
		//store obj.path0.path1 into propNames
		//in order: obj=>propNames, obj.path0=>propNames, obj.path0.path1=>propNames
		let p = '';
		for(let i=0, n=props.length; i<n; i++) {
			p += (i>0 ? '.' : '') + props[i];
			if(propNames.indexOf(p)==-1){
				propNames.push(p);
			}
		}
	}		
/////helper:END

///quarantine:begin	
// 	_removeSquareBrackets(s, trim) {
// 		return trim ? s.replace(/\s*\[{2}|\]{2}\s*/g, '') : s.replace(/\[{2}|\]{2}/g,'');
// 	}
//
// 	_funcInit(s, params, propNames, obj) {
// 		let f = this._removeSquareBrackets(s, true);
// 		obj.fname = this._funcName(f);//get function name
// 		let arr = this._funcArgs(f);//get function arguments
// 		for(let i=0, n=arr.length; i<n; i++) {
// 			let prop = arr[i];
// 			if(prop.length>0){
// 				let props = this._objPropPathSplit(prop);
// 				let isProp = false;
// 				if(this._prop.hasOwnProperty(props[0])) {
// 					isProp = props.length===1 || this._prop[props[0]].type===Object/*props.length>1 must be Object*/;
// 				}											
// 				let o = {};
// 				if(isProp) {
// 					o.token = prop;
// 					o.prop = prop;
// 					this._objPropPathToPropNames(props, propNames);
// 				} else {
// 				////trim singlequote or doublequote
// 					if(/^'|'$/g.test(prop)){
// 						prop = prop.replace(/^'|'$/g, '');
// 					} else if(/^"|"$/g.test(prop)) {
// 						prop = prop.replace(/^"|"$/g, '');
// 					}											
// 					o.token = prop;	
// 				}
// 				params.push(o);
// 			}//if(prop.length>0){
// 		}//for(let i=0;i<arr.length;i++) {
// 	}			
// 	
// 	_propOrFuncMatch(pn, s){
// 		let re = new RegExp('\\s*[\\[]{2}' + pn + '([.]\\S+)*[\\]]{2}\\s*', 'g');//[[property]] may multiple
// 		let propMatch = re.test(s);
// 		let funcMatch = false;
// 		if(!propMatch) {
// 			re = new RegExp('^\\s*[\\[]{2}\\S+[(](.+,\\s*)*' + pn + '(\\s*,.+)*[)][\\]]{2}\\s*$');//[[function(..,property,...)]] only one
// 			funcMatch = re.test(s);
// 		}
// 		re = null;
// 		return {
// 			'propMatch':propMatch,
// 			'funcMatch':funcMatch
// 		};
// 	}	
// 	
// 	_propInit(s, params, propNames) {
// 		let arr = s.match(/[\[]{2}[^\[]+[\]]{2}/g);
// 		for(let i=0, n=arr.length; i<n; i++){
// 			let token = arr[i];
// 			let prop = this._removeSquareBrackets(token, false);
// 			let props = this._objPropPathSplit(prop);
// 			if(this._prop.hasOwnProperty(props[0])) {
// 				if(props.length===1/*primitive type*/ || this._prop[props[0]].type===Object || this._prop[props[0]].type===Array) {
// 					params.push({'token':token, 'prop':prop});
// 					this._objPropPathToPropNames(props, propNames);
// 				}
// 			}
// 		}	
// 	}	
///quarantine:end
}

export default BeruangElement;