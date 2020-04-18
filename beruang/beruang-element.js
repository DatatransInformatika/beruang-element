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
	
	setPath(path, value) {
		let arr = this._objPropPathSplit(path);
		let ref = this._objPropPathRef(arr);
		ref.obj[ref.idx] = value;
		if(ref.obj!==this) {
			this.renderPath(path);
		}		
	}
	
	getPath(path) {
		let arr = this._objPropPathSplit(path);
		return this._objPropPathRef(arr).val;
	}
	
	renderPath(path) {
		let classes = this._propClsMap[path];		
		for(let i=0,n=!!classes ? classes.length : 0; i<n; i++) {
			this._renderClass(classes[i]);
		}	
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
					if(typeof(_val)==='function'){
						_val = _val();
					}					
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
						this.renderPath(pn);
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
	
	_configMapPrepare(ele) {
		let atts = [];				
		let text;
		let tmplText;
		let tmplType;
		if(ele.nodeName.toLowerCase()==='template') {
			if(ele.hasAttribute('if')){
				tmplText = ele.getAttribute('if');
				let re = /[!]{0,1}[\[]{2}[^\[]+[\]]{2}/; //g;
				if( re.test(tmplText) ){
					tmplText = (tmplText.match(re))[0];//only first term is captured, discard others if any
					tmplType = 'if';
				}
				re = null;
			} else if(ele.hasAttribute('each')){
				tmplText = ele.getAttribute('each');
				let re = /[\[]{2}[^\[]+[\]]{2}/; //g;
				if( re.test(tmplText) ){
					tmplText = (tmplText.match(re))[0];//only first term is captured, discard others if any
					tmplType = 'each';
				}
				re = null;
			}
			if(!!!tmplType){
				return null;
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
				return null;
			}
		}
		return {
			'atts':atts,
			'text':text,
			'tmplText':tmplText,
			'tmplType':tmplType	
		};	
	}
	
	_configMapInit(properties, prepare, ele, cls, pn, ifMap, eachMap, attMap, textMap, propNames) {
		let rslt = {};
		rslt['tmplmatch'] = !!prepare.tmplType ? this._propClsMapInitDoTmpl(properties, ele, prepare.tmplType, prepare.tmplType==='if' ? ifMap : eachMap, prepare.tmplText, pn, cls, propNames) : false; 
		rslt['attmatch'] = !!!prepare.tmplType && prepare.atts.length>0 ? this._propClsMapInitDoAttr(properties, ele, prepare.atts, pn, cls, propNames, attMap) : false;
		rslt['textmatch'] = !!!prepare.tmplType && prepare.text.length>0 ? this._propClsMapInitDoText(properties, prepare.text, pn, cls, propNames, textMap) : false;
		return rslt;
	}
	
	_propClsMapCreateDo(ele, cls, redrawClasses) {
		let prepare = this._configMapPrepare(ele);
		if(!!!prepare){
			return;
		}
		let redraw = false;
		for(let pn in this._prop) {		
			let propNames = [];
			let init = this._configMapInit(this._prop, prepare, ele, cls, pn, this._clsIfMap, this._clsEachMap, this._clsAttMap, this._clsTextMap, propNames);
			if(init.tmplmatch || init.attmatch || init.textmatch) {
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
	
	_termMatch(properties, text, pn, negation, propNames) { //break text into terms
		let refunc = new RegExp('[\\[]{2}\\S+[(]\\s*(.+,\\s*)*' + pn + '([.]\\S+)*(\\s*,.+)*\\s*[)][\\]]{2}');//function terms
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
			word = this._removeBrackets(word);
			if(isfunc){////is a function:BEGIN			
				let args = this._funcArgs(word);
				let params = [];				
				for(let i=0,n=args.length; i<n; i++) {
					let prop = args[i];
					if(prop.length>0){
						let props = this._objPropPathSplit(prop);//break obj.path0.path1 into array [obj,path0,path1]
						let isProp = this._isProperty(properties, props);
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
			} else {//is not a function			
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
				if(this._isProperty(properties, props)){
					params.push({'prop':word});
					this._objPropPathToPropNames(props, propNames);//store obj.path0.path1 into propNames
						//in order: obj=>propNames, obj.path0=>propNames, obj.path0.path1=>propNames									
				}				
				if(params.length>0){//non function must have params
					let term = {'fmt': fmt, 'params':params};
					if(!!event){
						term['event']=event;
					}
					terms.push(term);					
				}				
			}
		}
		refunc = null;
		reprop = null;		
		return {'fmt':format, 'terms':terms};
	}
	
	_propClsMapInitDoTmpl(properties, ele, tmplType, tmplMap, text, pn, cls, propNames) {//"if" or "each" template
		if(tmplMap.hasOwnProperty(cls)){
			return false;
		}			
		let negation = tmplType==='if';
		let d = this._termMatch(properties, text, pn, negation, propNames);
		if(!!!d){
			return false;
		}
		tmplMap[cls] = {'t':d};
		if(tmplType==='each') {
			ele.beruangtmpleach = {
				'as':ele.getAttribute('as') || 'item',
				'idx':ele.getAttribute('idx') || 'i'
			};			
		}	
		return true;
	}
	
	_propClsMapInitDoAttr(properties, ele, atts, pn, cls, propNames, map) {
		let obj = map[cls];
		let found = false;
		for(let i=0,n=atts.length;i<n;i++){
			let att = atts[i];			
			let fmt = ele.getAttribute(att);
			let d = this._termMatch(properties, fmt, pn, false, propNames);			
			if(!!d){
				found = true;
				if(!!!obj){					
					obj = {};
					map[cls] = obj;
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
	
	_propClsMapInitDoText(properties, text, pn, cls, propNames, map) {
		let d = this._termMatch(properties, text, pn, false, propNames);
		if(!!!d){
			return false;
		}
		let obj = map[cls];
		if(!!!obj){
			obj = {};
			map[cls] = obj;
		}		
		let attObj = obj['t'];
		if(!!!attObj){
			obj['t'] = d;
		} else {
			for(let j=0,m=d.terms.length;j<m;j++){
				attObj.terms.push(d.terms[j]);
			}					
		}		
		return true;
	}
/////class map config creation:BEGIN	

////render:BEGIN	
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
	
	_renderClassIf(ctm, el) {
		let obj = ctm['t'];
		let val = this._renderClassAttrValue(obj, el, null, null);
		let show = obj.fmt.charAt(0)==='!' ? !val : val;
		if(show){
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
				let tmplparent;
				while(!!elrun && elrun!==el) {
					el.beruangtmplchildren.push(elrun);
					elrun.beruangtmplparent=el;
					tmplparent = el;
					while(!!tmplparent){
						if(!!tmplparent.beruangsolveeach){
							this._tmplEachSolve(elrun,
								tmplparent.beruangsolveeach.as, 
								tmplparent.beruangsolveeach.idx, 
								tmplparent.beruangsolveeach.pn, 
								tmplparent.beruangsolveeach.i,
								false);
						}
						tmplparent = tmplparent.beruangtmplparent;
					}
					elrun = elrun.nextElementSibling;
				}					
				let redrawClasses = [];
				this._propClsMapCreate(elstart, el.beruangcls, redrawClasses, el);
				for(let i=0, n=redrawClasses.length; i<n; i++) {
					this._renderClass(redrawClasses[i]);
				}
			}		
		} else {
			this._tmplHide(el);
		};
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
	
	_tmplEachSolve(ele, as, idx, pn, i, findSibling) {
		while(!!ele) {
			this._solveEach(ele, as, idx, pn, i);
			this._tmplEachSolve(ele.firstElementChild, as, idx, pn, i, true);//recursive
			ele = findSibling ? ele.nextElementSibling : null;
		}
	}
	
	_solveEach(ele, as, idx, pn, i) {
		let properties = [];
		properties[as]={
			'type':Object, 'value':pn, 'conf':{
			'refunc':new RegExp('^' + as + '[.]'), 'rplcfunc':pn + '.' + i + '.',
			're':new RegExp('([\\[]{2})(' + as + '[.])(.+)'), 'rplc':'$1' + pn + '.' + i + '.$3'
			}};
		properties[idx]={
			'type':Number, 'value':i, 'conf':{
			'refunc':new RegExp('^' + idx + '$'), 'rplcfunc':i,
			're':new RegExp('([\\[]{2})(' + idx + ')([\\]]{2})'), 'rplc':i
			}};
		for(let p in properties){
			let prepare = this._configMapPrepare(ele);
			if(!!!prepare){
				return;
			}			
			let tmplMap={};
			let attMap={};
			let textMap={};		
			let propNames = [];					
			let init = this._configMapInit(properties, prepare, ele, 'c', p, tmplMap, tmplMap, attMap, textMap, propNames);			
			let prop = properties[p];
			if(init.tmplmatch){//template if or each
 				ele.setAttribute(prepare.tmplType, this._solveEachDo(tmplMap['c']['t'], p, prop.value, prop.conf));
 				if(!ele.hasOwnProperty('beruangsolveeach')){
 					ele.beruangsolveeach={'as':as,'idx':idx,'pn':pn,'i':i};					
 				}			
			}	
			if(init.attmatch){//attribute
 				let config = attMap['c'];
 				for(let att in config){				
 					ele.setAttribute(att, this._solveEachDo(config[att], p, prop.value, prop.conf));
 				};		
			}
			if(init.textmatch){//text content
				ele.innerHTML = this._solveEachDo(textMap['c']['t'], p, prop.value, prop.conf);				
			}
			prepare = null;
			init = null;
		}
		properties = null;		
	}
	
	_solveEachDo(map, pn, val, conf) {
		let fmt = map.fmt;
		for(let i=0,n=map.terms.length;i<n;i++){
			let term = map.terms[i];
			if(!!term.fname){//a function				
				let f = this._removeBrackets(term.fmt);
				let args = this._funcArgs(f);
				let len = args.length;
				let solved = false;
				let token;
				if(typeof(this[term.fname])==='function' && len<=1){
					if(len==0){
						token = this[term.fname].apply(null, null);
						solved = true;
					} else if(args[0]===pn) {
						token = this[term.fname].apply(null, [val]);
						solved = true;
					}
				}
				if(!solved){	
					token = '[[' + term.fname + '(';
					for(let j=0;j<len;j++){
						if(j>0){
							token += ',';
						}
						let arg = args[j];
						if(conf['refunc'].test(arg)){
							token += arg.replace(conf['refunc'], conf['rplcfunc']);
						} else {
							token += arg;		
						}
					}
					token += ')]]';
				}
				fmt = fmt.replace(term.fmt, token);
			} else {//not a function
				fmt = fmt.replace(term.fmt, term.fmt.replace(conf['re'], conf['rplc']));
			}
		}
		return fmt;		
	}
		
	_renderClassEach(ctm, el) {
		this._tmplHide(el);
		el.beruangtmplshown=true;//each template always shown
		let obj = ctm['t'];
		let arr = this._renderClassAttrValue(obj, el, null, null);
		if(arr.length===0){
			return;
		}
		let pn = obj.terms[0].params[0].prop;
		el.beruangtmplchildren = [];
		let sibling = el.previousElementSibling;
		for(let i=0, n=arr.length; i<n; i++){
			let clone = document.importNode(el.content, true);			
			el.parentNode.insertBefore(clone, el);
			let elstart = !!sibling ? sibling.nextElementSibling : el.parentNode.firstElementChild;
			let elrun = elstart;
			while(!!elrun && elrun!==el) {
				this._solveEach(elrun, el.beruangtmpleach.as, el.beruangtmpleach.idx, pn, i, false);
				el.beruangtmplchildren.push(elrun);
				elrun.beruangtmplparent=el;
				sibling = elrun;
				elrun = elrun.nextElementSibling;
			}						
		}		
		let redrawClasses = [];
		this._propClsMapCreate(el.beruangtmplchildren[0], el.beruangcls, redrawClasses, el);
		for(let i=0, n=redrawClasses.length; i<n; i++) {
			this._renderClass(redrawClasses[i]);
		}
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
					this.setPath(prop, el[att]);
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
					arr.push(this.getPath(param.prop));
				} else {
					arr.push(param.token);
				}
			}
			s = this[term.fname].apply(null, arr);		
		} else {//not a function
			s = this.getPath(params[0].prop);
		}
		return term.fmt===fmt ? s/*so boolean is not converted to string*/ : fmt.replace(term.fmt, s);	
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
	
	_removeBrackets(s){
		return s.replace(/^[\[]{2}|[\]]{2}$/g, '');//remove double brackets
	}
	
	_objPropPathSplit(s) {/*object and its properties path: obj.prop1.prop2...*/
		return s.split(/[.]/g);
	}
	
	_isProperty(properties, props) {
		if(properties.hasOwnProperty(props[0])) {
			return props.length===1
				|| properties[props[0]].type===Object || properties[props[0]].type===Array/*props.length>1 must be Object*/;
		}
		return false;
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
}

export default BeruangElement;