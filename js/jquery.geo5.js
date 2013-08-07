var _includeScript = function(u, onl) {
    var s = document.createElement("SCR" + "IPT");
    s.src = u;
    s.onload = onl;
    document.getElementsByTagName("HEAD")[0].appendChild(s);
}

;
(function($) {
    var $window = $(window);

    console.log("GEO5 ENABLED!");

    //Map plugin
    $.fn.geomap = function(method) {
        if (this[0].geomap && this[0].geomap[method]) {
            return this[0].geomap[method].apply(this[0].geomap, Array.prototype.slice.call(arguments, 1));
        } else if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on GEO5 geomap');
        }
    }

    var methods = {
        destroy: function() {
            return this.each(function() {
                var el = $(this);
                var data = el.data("geo5map");
                // clear the timeout
                // unbind all events namespaced with .geo5map
                el.unbind(".geo5map");
                // remove the main css class
                el.removeClass("geo5map");
            });
        },
        init: function(options) {
            var opts = $.extend({}, $.fn.geomap.defaults, options);
            opts.geoCentre = opts.geoCentre.split(",");

            for (var x = 0; x < opts.geoCentre.length; x++) {
                opts.geoCentre[x] = parseFloat(opts.geoCentre[x]);
            }
            return this.each(function() {

                var me = $(this);
                var myself = this;
                var mapID = me.attr("id");

                var data = {
                    opts: opts,
                    mapID: mapID
                };

                me.data("geo5map", data);
                var isSpecified = true;
                var layers = [];
                if (opts.geoBasemap == "None") {
                    isSpecified = false;
                } else {
                    //create the basemaps object
                    var basemap = L.tileLayer.provider(opts.geoBasemap);
                    var basemaps = {};
                    basemaps[opts.geoBasemap.replace(".", " - ")] = basemap;
                    layers.push(basemap);
                }


                $("[data-geo-type='basemap'][data-geo-map='" + mapID + "']").each(function() {
                    var $b = $(this);
                    var dat = $layer.data();
                    var lyr = L.tileLayer.provider(dat.geoBasemap);
                    basemaps[dat.geoBasemap.replace(".", " - ")] = lyr;
                    if (!isSpecified) {
                        layers.push(lyr);
                    }
                });


                //create the overlays object
                var overlays = {};
                $("[data-geo-type='tileLayer'][data-geo-map='" + mapID + "']").each(function() {
                    var $layer = $(this);
                    var dat = $layer.data();
                    var lyr = $layer.tileLayer(dat)[0].geolayer;
                    layers.push(lyr);
                });
                //create the leaflet map
                var map = L.map(this, {
                    center: new L.LatLng(opts.geoCentre[0], opts.geoCentre[1]),
                    zoom: opts.geoZoom,
                    layers: layers
                });
                map.onAdd=function(ll){
                	console.log("MAP ONADD",ll);
                }
                myself.geomap = map;


                //Find any bound UI for this map
                $("[data-geo-binding='" + mapID + "']").each(function() {
                    //Create a ViewModel for the Map
                    var m = myself.geomap;
                    myself.mapView = new MapViewModel(m);
                    //Bind the UI elements
                    ko.applyBindings(myself.mapView, this);
                });

                //Find any bound UI for this map's TileLayers
                $("[data-geo-type='tileLayer'][data-geo-map='" + mapID + "']").each(function() {
                    //Create a ViewModel for the Layer
                    var layerSelf=this;
                    var $layer = $(this);
                    
                    $("[data-geo-binding='" + $layer.attr("id") + "']").each(function() {
	                    //Bind the UI elements
	                    if(!layerSelf.layerView){
	                    	layerSelf.layerView = new TileLayerViewModel(layerSelf.geolayer,layerSelf);
	                    }
	                    ko.applyBindings(layerSelf.layerView, this);
	                });
                });

                //Create all the featureLayers - feature Layers add themself to the map due to the delayed loading of data
                $("[data-geo-type='featureLayer'][data-geo-map='" + mapID + "']").each(function() {
                	var $layer = $(this);
                    var dat = $layer.data();
                    $layer.featureLayer(dat);
                });
            });
        }
    };

    $.fn.geomap.defaults = {
        method: "",
        geoCentre: "51.505, -0.09",
        geoZoom: 13,
        geoBasemap: "Esri.WorldGrayCanvas",
        showLayers: true
    };

    function TileLayerViewModel(layer,config){
    	var self		= this;
    	self._layer		= layer;
    	self._config	= config;
    	self.id   		= $(config).attr("id") || layer._leaflet_id;
    	self.title 		= $(config).data("geoLayerTitle") || self.id;
    	self.features   = ko.observableArray();

    	self._visible	= ko.observable(true);
    	this.visible = ko.computed({
            read: function() {
                return self._visible();
            },
            write: function(value) {
            	if(!value){
            		self._layer.setOpacity(0);
            	}else{
            		self._layer.setOpacity(1.0);
            	}
            	self._visible(value);
            },
            owner: this
        });

    }

    function FeatureLayerViewModel(layer,config){
    	var self		= this;
    	self._layer		= layer;
    	self._config	= config;
    	self.id   		= $(self._config).attr("id") || self._layer._leaflet_id;
    	self.title 		= $(self._config).data("geoLayerTitle") || self.id;
    	self.features   = ko.observableArray();
    	self.selection  = ko.observableArray();

    	var feats=self._layer.getLayers();

    	feats.forEach(function(f){
    		try{
    			self.features.push(new FeatureViewModel(f,self._layer));
    		}catch(errrr){
    			console.log("errrrrrrrrrp",f,errrr);
    		}
    	});

    	self._visible	= ko.observable(self._layer._map.hasLayer(layer));
    	this.visible = ko.computed({
            read: function() {
                return self._visible();
            },
            write: function(value) {
            	if(self._visible()){
            		self._layer._map.removeLayer(self._layer);
            	}else{
            		self._layer._map.addLayer(self._layer);
            	}
            	self._visible(self._layer._map.hasLayer(self._layer));
            },
            owner: this
        });
    }

    function FeatureViewModel(f,layer){
    	var self		= this;
    	self._f 		= f;
    	self._feature	= f.feature;
    	self._layer		= layer;
    	self._icon		= self._f._icon || null;

    	if(self._icon){
    		self.icon={
    			src:self._icon.src,
    			html:self._icon.outerHTML
    		}
    	}else{
    		self.icon={
    			src:"http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
    			html:""
    		}
    	}

    	self.geometry	= self._feature.geometry;
    	var props={};
    	for(var p in self._feature.properties){
    		if(typeof(self._feature.properties[p])!=="function"){
    			props[p]=ko.observable(self._feature.properties[p]);
    		}

    	}
    	self.properties	= props;
    	self.selected	= ko.observable(false);

    	self.openPopup  = function(){
    		self._f.openPopup();
    	}

    	self.closePopup  = function(){
    		self._f.closePopup();
    	}
    }

    function MapViewModel(map) {
        var self = this;
        self.map = map;
        self._zoom = ko.observable(self.map.getZoom());
        self._centre = {
            lat: ko.observable(self.map.getCenter().lat),
            lng: ko.observable(self.map.getCenter().lng)
        }
        self._mouse = {
            lat: ko.observable(0.00),
            lng: ko.observable(0.00)
        }

        map.on("zoomend", function(evt) {
            self._zoom(evt.target.getZoom());
        });
        this.zoom = ko.computed({
            read: function() {
                return self._zoom();
            },
            write: function(value) {
                self.map.setZoom(value);
                self._zoom(value);
            },
            owner: this
        });
        map.on("zoomend", function(evt) {
            self._centre.lat(evt.target.getCenter().lat);
            self._centre.lng(evt.target.getCenter().lng);
        });
        map.on("moveend", function(evt) {
            self._centre.lat(evt.target.getCenter().lat);
            self._centre.lng(evt.target.getCenter().lng);
        });

        this.centre = ko.computed({
            read: function() {
                return {
                    lat: self._centre.lat(),
                    lng: self._centre.lng()
                };
            },
            write: function(value) {
                if (value.lat && value.lng) {
                    self.map.setView(new L.LatLng(value.lat, value.lng), self.map.getZoom());
                } else if (value.length && value.length == 2) {
                    self.map.setView(new L.LatLng(value[0], value[1]));
                }
            },
            owner: this
        });

        map.on("mousemove", function(evt) {
            self._mouse.lat(evt.latlng.lat);
            self._mouse.lng(evt.latlng.lng);
        });
        this.mouseLocation = ko.computed({
            read: function() {
                return {
                    lat: self._mouse.lat(),
                    lng: self._mouse.lng()
                };
            },
            owner: this
        });
    }

    //TileLayer plugin
    $.fn.tileLayer = function(method) {
        if (this[0].geolayer && this[0].geolayer[method]) {
            return this[0].geolayer[method].apply(this[0].geolayer, Array.prototype.slice.call(arguments, 1));
        } else if (tilemethods[method]) {
            return tilemethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return tilemethods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on GEO5 tileLayer');
        }
    }

    var tilemethods = {
        destroy: function() {
            return this.each(function() {
                var el = $(this);
                var data = el.data("geo5tileLayer");

                // unbind all events namespaced with .geo5tileLayer
                el.unbind(".geo5tileLayer");

                // remove the main css class
                el.removeClass("geo5tileLayer");

            });

        },

        init: function(options) {
            var opts = $.extend({}, $.fn.tileLayer.defaults, options);

            return this.each(function() {

                var me = $(this);
                if (!me.hasClass("geo5tileLayer")) {
                    var layerID = me.attr("id");

                    me.addClass("geo5tileLayer");
                    var data = {
                        opts: opts,
                        layerID: layerID
                    };

                    me.data("geo5tileLayer", data);

                    //create the tile layer
                    if (opts.geoLayerType == "ArcGIS") {
                        this.geolayer = L.tileLayer(opts.geoLayerUrl + "/tile/{z}/{y}/{x}");
                        //http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
                    } else if (opts.geoLayerType == "TMS") {
                        this.geolayer = L.tileLayer(opts.geoLayerUrl);
                    } else if (opts.geoLayerType == "WMS") {
                        var lyr = {
                            layers: opts.wmsLayers || '*',
                            format: opts.wmsFormat || 'image/png',
                            transparent: opts.wmsTransparent || true
                        };
                        this.geolayer = L.tileLayer.wms(opts.geoLayerUrl, lyr);
                    } else {
                        this.geolayer = L.tileLayer.provider(opts.geoLayerType);
                    }
                }
            });
        }

    };

    $.fn.tileLayer.defaults = {
        method: "",
        geoLayerType: "Esri.WorldGrayCanvas"
    };


    //featureLayer plugin
    $.fn.featureLayer = function(method) {
        if (this[0].geolayer && this[0].geolayer[method]) {
            return this[0].geolayer[method].apply(this[0].geolayer, Array.prototype.slice.call(arguments, 1));
        } else if (featureLayermethods[method]) {
            return featureLayermethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return featureLayermethods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on GEO5 featureLayer');
        }
    }

    var featureLayermethods = {
        destroy: function() {
            return this.each(function() {
                var el = $(this);
                var data = el.data("geo5featureLayer");

                // unbind all events namespaced with .geo5feautreLayer
                el.unbind(".geo5featureLayer");

                // remove the main css class
                el.removeClass("geo5featureLayer");

            });

        },

        init: function(options) {
            var opts = $.extend({}, $.fn.featureLayer.defaults, options);

            return this.each(function() {

                var me = $(this);
                var self=this;
                if (!me.hasClass("geo5featureLayer")) {
                    var layerID = me.attr("id");

                    me.addClass("geo5featureLayer");
                    var data = {
                        opts: opts,
                        layerID: layerID
                    };

                    me.data("geo5featureLayer", data);

                    //has an infotemplate been specified for this layer?
                    if (!me.data("layerPopupTemplate")) {
                        //Get  Popup Templates
                        var tmpl = $("[data-geo-type='layerPopup'][data-geo-layer='" + data.layerID + "']");
                        var _geo5_popup = null;
                        if (tmpl.length > 0) {
                            if ($(tmpl[0]).data("contentType") && $(tmpl[0]).data("contentType").toLowerCase() == "script") {
                                try {
                                    _geo5_popup = eval("_geo5_popup=function(properties){" + $(tmpl[0]).html().trim() + "\n}"); //JSON.parse(sym[0].innerText);
                                    if (_geo5_popup != null && typeof(_geo5_popup) == "function") {
                                        opts.layerPopupTemplate = _geo5_popup;
                                    }
                                } catch (symErr) {
                                    console.error("Error Parsing InfoTemplate Script object", symErr);
                                }
                            } else {
                                _geo5_popup = $(tmpl[0]).html().trim();
                                if (_geo5_popup != null && _geo5_popup.length > 0) {
                                    opts.layerPopupTemplate = _geo5_popup;
                                }
                            }
                        }
                    }
                    //Get Symbology and Popup Templates

                    var sym = $("[data-geo-type='geoStyle'][data-geo-layer='" + data.layerID + "']");
                    var symbology = null;
                    if (sym.length > 0) {
                        try {
                            symbology = eval("symbology=" + $(sym[0]).html().trim() + ";"); //JSON.parse(sym[0].innerText);
                        } catch (symErr) {
                            console.error("Error Parsing symbology object", symErr);
                        }
                    }

                    //create the tile layer
                    if (opts.geoLayerType == "geojson") {
                        //Where does the data come from
                        //data-geo-layer-url ?
                        if (opts.geoLayerUrl) {
                            var deferred = $.Deferred();

							deferred.done(function() {
							   if (data.opts.geoMap) {
                                    self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                                    //Find any bound UI for this map's vectorLayers
				                    try{
					                    $("[data-geo-binding='" + data.layerID + "']").each(function() {
						                    //Bind the UI elements
						                    if(!self.layerView){
						                    	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
						                   	}
						                    ko.applyBindings(self.layerView, this);
						                });
				                	}catch(err){
				                		console.log("ERROR",err);
				                	}
                                }
							});
                            $.getJSON(opts.geoLayerUrl, function(dat) {
                                if (symbology) {
                                    self.geolayer = L.geoJson(dat, {
                                        pointToLayer: function(feature, latlng) {
                                            return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                        },
                                        style: function(feature) {
                                            return $.fn.featureLayer.getStyle(feature, symbology);
                                        },
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
									deferred.resolve();
                                } else {
                                    self.geolayer = L.geoJson(dat, {
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
                                    deferred.resolve();
                                }
                            });
                        } else if (this.src != null && this.src.length > 0) {
                            var deferred = $.Deferred();

							deferred.done(function() {
							   if (data.opts.geoMap) {
                                    self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                                    //Find any bound UI for this map's vectorLayers
				                    try{
					                    $("[data-geo-binding='" + data.layerID + "']").each(function() {
						                    //Bind the UI elements
						                    if(!self.layerView){
						                    	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
						                   	}
						                    ko.applyBindings(self.layerView, this);
						                });
				                	}catch(err){
				                		console.log("ERROR",err);
				                	}
                                }
							});
                            $.getJSON(self.src, function(dat) {
                                if (symbology) {
                                    self.geolayer = L.geoJson(dat, {
                                        pointToLayer: function(feature, latlng) {
                                            return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                        },
                                        style: function(feature) {
                                            return $.fn.featureLayer.getStyle(feature, symbology);
                                        },
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
									deferred.resolve();
                                } else {
                                    self.geolayer = L.geoJson(dat, {
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
                                    deferred.resolve();
                                }
                               
                            });
                        } else if (this.href != null) {
                            var deferred = $.Deferred();

							deferred.done(function() {
							   if (data.opts.geoMap) {
                                    self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                                    //Find any bound UI for this map's vectorLayers
				                    try{
					                    $("[data-geo-binding='" + data.layerID + "']").each(function() {
						                    //Bind the UI elements
						                    if(!self.layerView){
						                    	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
						                   	}
						                    ko.applyBindings(self.layerView, this);
						                });
				                	}catch(err){
				                		console.log("ERROR",err);
				                	}
                                }
							});

                            $.getJSON(self.href, function(dat) {
                                if (symbology) {
                                    self.geolayer = L.geoJson(dat, {
                                        pointToLayer: function(feature, latlng) {
                                            return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                        },
                                        style: function(feature) {
                                            return $.fn.featureLayer.getStyle(feature, symbology);
                                        },
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
									deferred.resolve();
                                } else {
                                    self.geolayer = L.geoJson(dat, {
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
                                    deferred.resolve();
                                }
                                
                            });
                        } else {
                            var deferred = $.Deferred();

							deferred.done(function() {
							   if (data.opts.geoMap) {
                                    self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                                    //Find any bound UI for this map's vectorLayers
				                    try{
					                    $("[data-geo-binding='" + data.layerID + "']").each(function() {
						                    //Bind the UI elements
						                    if(!self.layerView){
						                    	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
						                   	}
						                    ko.applyBindings(self.layerView, this);
						                });
				                	}catch(err){
				                		console.log("ERROR",err);
				                	}
                                }
							});

                            var dat = JSON.parse(this.innerText);
                            if (symbology) {
                                self.geolayer = L.geoJson(dat, {
                                    pointToLayer: function(feature, latlng) {
                                        return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                    },
                                    style: function(feature) {
                                        return $.fn.featureLayer.getStyle(feature, symbology);
                                    },
                                    onEachFeature: function(feature, layer) {
                                        var popup = '';
                                        if (typeof(opts.layerPopupTemplate) == "function") {
                                            popup = opts.layerPopupTemplate(feature.properties);
                                        } else {
                                            popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                        }
                                        layer.bindPopup(popup);
                                    }
                                });
								deferred.resolve();
                            } else {
                                self.geolayer = L.geoJson(dat, {
                                    onEachFeature: function(feature, layer) {
                                        var popup = '';
                                        if (typeof(opts.layerPopupTemplate) == "function") {
                                            popup = opts.layerPopupTemplate(feature.properties);
                                        } else {
                                            popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                        }
                                        layer.bindPopup(popup);
                                    }
                                });
                                deferred.resolve();
                            }

                        }
                        //content ?
                    } else if (opts.geoLayerType == "csv") {
                        //Where does the data come from
                        //data-geo-layer-url ?
                        if (opts.geoLayerUrl) {
                            var deferred = $.Deferred();
                        	deferred.done(function(){
                        		//Find any bound UI for this map's vectorLayers
								try{
								    $("[data-geo-binding='" + data.layerID + "']").each(function() {
								        //Bind the UI elements
								        if(!self.layerView){
								        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
								       	}
								        ko.applyBindings(self.layerView, this);
								    });
								}catch(err){
									console.log("ERROR",err);
								}
                        	});
                            $.get(opts.geoLayerUrl, function(dat) {
                                if (symbology) {
                                    self.geolayer = L.geoCsv(dat, {
                                        titles: opts.layerTitles,
                                        fieldSeparator: opts.layerFieldSeparator,
                                        lineSeparator: opts.layerLineSeparator,
                                        deleteDobleQuotes: opts.layerDeleteQuotes,
                                        firstLineTitles: opts.layerFirstLineTitles,
                                        pointToLayer: function(feature, latlng) {
                                            return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                        },
                                        style: function(feature) {
                                            return $.fn.featureLayer.getStyle(feature, symbology);
                                        },
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
                                } else {
                                    self.geolayer = L.geoCsv(dat, {
                                        titles: opts.layerTitles,
                                        fieldSeparator: opts.layerFieldSeparator,
                                        lineSeparator: opts.layerLineSeparator,
                                        deleteDobleQuotes: opts.layerDeleteQuotes,
                                        firstLineTitles: opts.layerFirstLineTitles,
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
                                }
                                if (data.opts.geoMap) {
                                    self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                                }
                                deferred.resolve();
                            });
                        } else if (this.src != null && this.src.length > 0) {
                            var deferred = $.Deferred();
                        	deferred.done(function(){
                        		//Find any bound UI for this map's vectorLayers
								try{
								    $("[data-geo-binding='" + data.layerID + "']").each(function() {
								        //Bind the UI elements
								        if(!self.layerView){
								        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
								       	}
								        ko.applyBindings(self.layerView, this);
								    });
								}catch(err){
									console.log("ERROR",err);
								}
                        	});
                            $.get(this.src, function(dat) {
                                if (symbology) {
                                    self.geolayer = L.geoCsv(dat, {
                                        titles: opts.layerTitles,
                                        fieldSeparator: opts.layerFieldSeparator,
                                        lineSeparator: opts.layerLineSeparator,
                                        deleteDobleQuotes: opts.layerDeleteQuotes,
                                        firstLineTitles: opts.layerFirstLineTitles,
                                        pointToLayer: function(feature, latlng) {
                                            return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                        },
                                        style: function(feature) {
                                            return $.fn.featureLayer.getStyle(feature, symbology);
                                        },
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
                                } else {
                                    self.geolayer = L.geoCsv(dat, {
                                        titles: opts.layerTitles,
                                        fieldSeparator: opts.layerFieldSeparator,
                                        lineSeparator: opts.layerLineSeparator,
                                        deleteDobleQuotes: opts.layerDeleteQuotes,
                                        firstLineTitles: opts.layerFirstLineTitles,
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
                                }
                                if (data.opts.geoMap) {
                                    self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                                }
                                deferred.resolve();
                            });
                        } else if (this.href != null) {
                            var deferred = $.Deferred();
                        	deferred.done(function(){
                        		//Find any bound UI for this map's vectorLayers
								try{
								    $("[data-geo-binding='" + data.layerID + "']").each(function() {
								        //Bind the UI elements
								        if(!self.layerView){
								        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
								       	}
								        ko.applyBindings(self.layerView, this);
								    });
								}catch(err){
									console.log("ERROR",err);
								}
                        	});
                            $.get(this.href, function(dat) {
                                if (symbology) {
                                    self.geolayer = L.geoCsv(dat, {
                                        titles: opts.layerTitles,
                                        fieldSeparator: opts.layerFieldSeparator,
                                        lineSeparator: opts.layerLineSeparator,
                                        deleteDobleQuotes: opts.layerDeleteQuotes,
                                        firstLineTitles: opts.layerFirstLineTitles,
                                        pointToLayer: function(feature, latlng) {
                                            return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                        },
                                        style: function(feature) {
                                            return $.fn.featureLayer.getStyle(feature, symbology);
                                        },
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
                                } else {
                                    self.geolayer = L.geoCsv(dat, {
                                        titles: opts.layerTitles,
                                        fieldSeparator: opts.layerFieldSeparator,
                                        lineSeparator: opts.layerLineSeparator,
                                        deleteDobleQuotes: opts.layerDeleteQuotes,
                                        firstLineTitles: opts.layerFirstLineTitles,
                                        onEachFeature: function(feature, layer) {
                                            var popup = '';
                                            if (typeof(opts.layerPopupTemplate) == "function") {
                                                popup = opts.layerPopupTemplate(feature.properties);
                                            } else {
                                                popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                            }
                                            layer.bindPopup(popup);
                                        }
                                    });
                                }
                                if (data.opts.geoMap) {
                                    self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                                }
                                deferred.resolve();
                            });
                        } else {
                            var deferred = $.Deferred();
                        	deferred.done(function(){
                        		//Find any bound UI for this map's vectorLayers
								try{
								    $("[data-geo-binding='" + data.layerID + "']").each(function() {
								        //Bind the UI elements
								        if(!self.layerView){
								        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
								       	}
								        ko.applyBindings(self.layerView, this);
								    });
								}catch(err){
									console.log("ERROR",err);
								}
                        	});
                            var dat = this.innerText;
                            if (symbology) {
                                self.geolayer = L.geoCsv(dat, {
                                    titles: opts.layerTitles,
                                    fieldSeparator: opts.layerFieldSeparator,
                                    lineSeparator: opts.layerLineSeparator,
                                    deleteDobleQuotes: opts.layerDeleteQuotes,
                                    firstLineTitles: opts.layerFirstLineTitles,
                                    pointToLayer: function(feature, latlng) {
                                        return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                    },
                                    style: function(feature) {
                                        return $.fn.featureLayer.getStyle(feature, symbology);
                                    },
                                    onEachFeature: function(feature, layer) {
                                        var popup = '';
                                        if (typeof(opts.layerPopupTemplate) == "function") {
                                            popup = opts.layerPopupTemplate(feature.properties);
                                        } else {
                                            popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                        }
                                        layer.bindPopup(popup);
                                    }
                                });

                            } else {
                                self.geolayer = L.geoCsv(dat, {
                                    titles: opts.layerTitles,
                                    fieldSeparator: opts.layerFieldSeparator,
                                    lineSeparator: opts.layerLineSeparator,
                                    deleteDobleQuotes: opts.layerDeleteQuotes,
                                    firstLineTitles: opts.layerFirstLineTitles,
                                    onEachFeature: function(feature, layer) {
                                        var popup = '';
                                        if (typeof(opts.layerPopupTemplate) == "function") {
                                            popup = opts.layerPopupTemplate(feature.properties);
                                        } else {
                                            popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                        }
                                        layer.bindPopup(popup);
                                    }
                                });
                            }
                            if (data.opts.geoMap) {
                                self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                            }
                            deferred.resolve();
                        }
                    } else if (opts.geoLayerType == "gpx") {
                    	var deferred = $.Deferred();
                    	deferred.done(function(){
                    		//Find any bound UI for this map's vectorLayers
							try{
							    $("[data-geo-binding='" + data.layerID + "']").each(function() {
							        //Bind the UI elements
							        if(!self.layerView){
							        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
							       	}
							        ko.applyBindings(self.layerView, this);
							    });
							}catch(err){
								console.log("ERROR",err);
							}
                    	});
                        if (opts.geoLayerUrl) {

                            self.geolayer = new L.GPX(this.href, {
                                async: true,
                                marker_options: {
                                    startIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-start.png',
                                    endIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-end.png',
                                    shadowUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-shadow.png',
                                }
                            })
                            if (data.opts.geoMap) {
                                self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                            }
                            deferred.resolve();
                        } else if (this.src && this.src.length > 0) {
                            self.geolayer = new L.GPX(this.href, {
                                async: true,
                                marker_options: {
                                    startIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-start.png',
                                    endIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-end.png',
                                    shadowUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-shadow.png',
                                }
                            })
                            if (data.opts.geoMap) {
                                self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                            }
                            deferred.resolve();
                        } else if (this.href && this.href.length > 0) {
                            self.geolayer = new L.GPX(this.href, {
                                async: true,
                                marker_options: {
                                    startIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-start.png',
                                    endIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-end.png',
                                    shadowUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-shadow.png',
                                }
                            })
                            if (data.opts.geoMap) {
                                self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                            }
                            deferred.resolve();
                        } else {
                            self.geolayer = new L.GPX(self.innerText, {
                                async: true,
                                marker_options: {
                                    startIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-start.png',
                                    endIconUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-icon-end.png',
                                    shadowUrl: 'http://github.com/mpetazzoni/leaflet-gpx/raw/master/pin-shadow.png',
                                }
                            })
                            if (data.opts.geoMap) {
                                self.geolayer.addTo($("#" + data.opts.geoMap)[0].geomap);
                            }
                            deferred.resolve();
                        }
                    } else if (opts.geoLayerType == "kml") {
                    	var deferred = $.Deferred();
                    	deferred.done(function(){
                    		//Find any bound UI for this map's vectorLayers
							try{
							    $("[data-geo-binding='" + data.layerID + "']").each(function() {
							        //Bind the UI elements
							        if(!self.layerView){
							        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
							       	}
							        ko.applyBindings(self.layerView, this);
							    });
							}catch(err){
								console.log("ERROR",err);
							}
                    	});
                        if (opts.geoLayerUrl) {
                            self.geolayer = new L.KML(opts.geoLayerUrl, {
                                async: true
                            })
                            if (data.opts.geoMap) {
                                $("#" + data.opts.geoMap)[0].geomap.addLayer(self.geolayer);
                            }
                            deferred.resolve();
                        } else if (this.src && this.src.length > 0) {
                            self.geolayer = new L.KML(this.src, {
                                async: true
                            })
                            if (data.opts.geoMap) {
                                $("#" + data.opts.geoMap)[0].geomap.addLayer(self.geolayer);
                            }
                            deferred.resolve();
                        } else if (this.href && this.href.length > 0) {
                            self.geolayer = new L.KML(this.href, {
                                async: true
                            })
                            if (data.opts.geoMap) {
                                $("#" + data.opts.geoMap)[0].geomap.addLayer(self.geolayer);
                            }
                            deferred.resolve();
                        } else {
                            self.geolayer = new L.KML(this.innerText, {
                                async: true
                            })
                            if (data.opts.geoMap) {
                                $("#" + data.opts.geoMap)[0].geomap.addLayer(self.geolayer);
                            }
                            deferred.resolve();
                        }
                    } else if (opts.geoLayerType == "arcgis") {

                        if (opts.geoLayerUrl) {
                            if (symbology) {
                            	var deferred = $.Deferred();
                            	deferred.done(function(){
                            		//Find any bound UI for this map's vectorLayers
									try{
									    $("[data-geo-binding='" + data.layerID + "']").each(function() {
									        //Bind the UI elements
									        if(!self.layerView){
									        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
									       	}
									        ko.applyBindings(self.layerView, this);
									    });
									}catch(err){
										console.log("ERROR",err);
									}
                            	});
                                //try and us
                                self.geolayer = L.esri.featureLayer(opts.geoLayerUrl, {
                                    pointToLayer: function(feature, latlng) {
                                        return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                    },
                                    style: function(feature) {
                                        return $.fn.featureLayer.getStyle(feature, symbology);
                                    },
                                    onEachFeature: function(feature, layer) {
                                        if(opts._delay){
                                    		window.clearTimeout(opts._delay);
                                    	}
                                    	
                                        var popup = '';
                                        if (typeof(opts.layerPopupTemplate) == "function") {
                                            popup = opts.layerPopupTemplate(feature.properties);
                                        } else {
                                            popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                        }
                                        layer.bindPopup(popup);
                                        opts._delay=window.setTimeout(function(){
                                    		deferred.resolve();
                                    	},100);
                                    }
                                }).addTo($("#" + opts.geoMap)[0].geomap);
                            } else {
                            	var deferred = $.Deferred();
                            	deferred.done(function(){
                            		//Find any bound UI for this map's vectorLayers
									try{
									    $("[data-geo-binding='" + data.layerID + "']").each(function() {
									        //Bind the UI elements
									        if(!self.layerView){
									        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
									       	}
									        ko.applyBindings(self.layerView, this);
									    });
									}catch(err){
										console.log("ERROR",err);
									}
                            	});
                                //try and use the esri symbology
                                $.ajax({
                                    url: opts.geoLayerUrl + "?f=json",
                                    dataType: 'jsonp',
                                    success: function(d) {
                                        symbology = $.fn.featureLayer._convertEsriOptions(d).symbology;
                                        self.geolayer = L.esri.featureLayer(opts.geoLayerUrl, {
                                            pointToLayer: function(feature, latlng) {
                                                return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                            },
                                            style: function(feature) {
                                                return $.fn.featureLayer.getStyle(feature, symbology);
                                            },
                                            onEachFeature: function(feature, layer) {
                                               if(opts._delay){
		                                    		window.clearTimeout(opts._delay);
		                                    	}
		                                    	
		                                        var popup = '';
		                                        if (typeof(opts.layerPopupTemplate) == "function") {
		                                            popup = opts.layerPopupTemplate(feature.properties);
		                                        } else {
		                                            popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
		                                        }
		                                        layer.bindPopup(popup);
		                                        opts._delay=window.setTimeout(function(){
		                                    		deferred.resolve();
		                                    	},100);
                                            }
                                        }).addTo($("#" + opts.geoMap)[0].geomap);
                                    },
                                    error: function() {
                                        self.geolayer = L.esri.featureLayer(opts.geoLayerUrl, {
                                            onEachFeature: function(feature, layer) {
                                                var popup = '';
                                                if (typeof(opts.layerPopupTemplate) == "function") {
                                                    popup = opts.layerPopupTemplate(feature.properties);
                                                } else {
                                                    popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                                }
                                                layer.bindPopup(popup);
                                            }
                                        }).addTo($("#" + opts.geoMap)[0].geomap);
                                    },
                                    jsonp: 'callback'
                                });
                            }
                        } else if (this.src && this.src.length > 0) {
                            if (symbology) {
                            	var deferred = $.Deferred();
                            	deferred.done(function(){
                            		//Find any bound UI for this map's vectorLayers
									try{
									    $("[data-geo-binding='" + data.layerID + "']").each(function() {
									        //Bind the UI elements
									        if(!self.layerView){
									        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
									       	}
									        ko.applyBindings(self.layerView, this);
									    });
									}catch(err){
										console.log("ERROR",err);
									}
                            	});
                                self.geolayer = L.esri.featureLayer(self.src, {
                                    pointToLayer: function(feature, latlng) {
                                        return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                    },
                                    style: function(feature) {
                                        return $.fn.featureLayer.getStyle(feature, symbology);
                                    },
                                    onEachFeature: function(feature, layer) {
                                        if(opts._delay){
                                    		window.clearTimeout(opts._delay);
                                    	}
                                    	
                                        var popup = '';
                                        if (typeof(opts.layerPopupTemplate) == "function") {
                                            popup = opts.layerPopupTemplate(feature.properties);
                                        } else {
                                            popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                        }
                                        layer.bindPopup(popup);
                                        opts._delay=window.setTimeout(function(){
                                    		deferred.resolve();
                                    	},100);
                                    }
                                }).addTo($("#" + opts.geoMap)[0].geomap);
                            } else {
                            	var deferred = $.Deferred();
                            	deferred.done(function(){
                            		//Find any bound UI for this map's vectorLayers
									try{
									    $("[data-geo-binding='" + data.layerID + "']").each(function() {
									        //Bind the UI elements
									        if(!self.layerView){
									        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
									       	}
									        ko.applyBindings(self.layerView, this);
									    });
									}catch(err){
										console.log("ERROR",err);
									}
                            	});
                                //try and use the esri symbology
                                $.ajax({
                                    url: self.src + "?f=json",
                                    dataType: 'jsonp',
                                    success: function(d) {
                                        symbology = $.fn.featureLayer._convertEsriOptions(d).symbology;
                                        self.geolayer = L.esri.featureLayer(self.src, {
                                            pointToLayer: function(feature, latlng) {
                                                return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                            },
                                            style: function(feature) {
                                                return $.fn.featureLayer.getStyle(feature, symbology);
                                            },
                                            onEachFeature: function(feature, layer) {
                                                if(opts._delay){
		                                    		window.clearTimeout(opts._delay);
		                                    	}
		                                    	
		                                        var popup = '';
		                                        if (typeof(opts.layerPopupTemplate) == "function") {
		                                            popup = opts.layerPopupTemplate(feature.properties);
		                                        } else {
		                                            popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
		                                        }
		                                        layer.bindPopup(popup);
		                                        opts._delay=window.setTimeout(function(){
		                                    		deferred.resolve();
		                                    	},100);
                                            }
                                        }).addTo($("#" + opts.geoMap)[0].geomap);
										//Find any bound UI for this map's vectorLayers
										try{
										    $("[data-geo-binding='" + data.layerID + "']").each(function() {
										        //Bind the UI elements
										        if(!self.layerView){
										        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
										       	}
										        ko.applyBindings(self.layerView, this);
										    });
										}catch(err){
											console.log("ERROR",err);
										}
                                    },
                                    error: function() {
                                        self.geolayer = L.esri.featureLayer(self.src, {
                                            onEachFeature: function(feature, layer) {
                                                var popup = '';
                                                if (typeof(opts.layerPopupTemplate) == "function") {
                                                    popup = opts.layerPopupTemplate(feature.properties);
                                                } else {
                                                    popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                                }
                                                layer.bindPopup(popup);
                                            }
                                        }).addTo($("#" + opts.geoMap)[0].geomap);
                                    },
                                    jsonp: 'callback'
                                });
                            }

                        } else if (this.href && this.href.length > 0) {
                            if (symbology) {
                            	var deferred = $.Deferred();
                            	deferred.done(function(){
                            		//Find any bound UI for this map's vectorLayers
									try{
									    $("[data-geo-binding='" + data.layerID + "']").each(function() {
									        //Bind the UI elements
									        if(!self.layerView){
									        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
									       	}
									        ko.applyBindings(self.layerView, this);
									    });
									}catch(err){
										console.log("ERROR",err);
									}
                            	});
                                self.geolayer = L.esri.featureLayer(self.href, {
                                    pointToLayer: function(feature, latlng) {
                                        return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                    },
                                    style: function(feature) {
                                        return $.fn.featureLayer.getStyle(feature, symbology);
                                    },
                                    onEachFeature: function(feature, layer) {
                                        if(opts._delay){
                                    		window.clearTimeout(opts._delay);
                                    	}
                                    	
                                        var popup = '';
                                        if (typeof(opts.layerPopupTemplate) == "function") {
                                            popup = opts.layerPopupTemplate(feature.properties);
                                        } else {
                                            popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                        }
                                        layer.bindPopup(popup);
                                        opts._delay=window.setTimeout(function(){
                                    		deferred.resolve();
                                    	},100);
                                    }
                                }).addTo($("#" + opts.geoMap)[0].geomap);

								//Find any bound UI for this map's vectorLayers
								try{
								    $("[data-geo-binding='" + data.layerID + "']").each(function() {
								        //Bind the UI elements
								        if(!self.layerView){
								        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
								       	}
								        ko.applyBindings(self.layerView, this);
								    });
								}catch(err){
									console.log("ERROR",err);
								}
                            } else {
                            	var deferred = $.Deferred();
                            	deferred.done(function(){
                            		//Find any bound UI for this map's vectorLayers
									try{
									    $("[data-geo-binding='" + data.layerID + "']").each(function() {
									        //Bind the UI elements
									        if(!self.layerView){
									        	self.layerView = new FeatureLayerViewModel(self.geolayer,self);
									       	}
									        ko.applyBindings(self.layerView, this);
									    });
									}catch(err){
										console.log("ERROR",err);
									}
                            	});
                                //try and use the esri symbology
                                $.ajax({
                                    url: self.href + "?f=json",
                                    dataType: 'jsonp',
                                    success: function(d) {
                                        symbology = $.fn.featureLayer._convertEsriOptions(d).symbology;
                                        self.geolayer = L.esri.featureLayer(self.href, {
                                            pointToLayer: function(feature, latlng) {
                                                return L.marker(latlng, $.fn.featureLayer.getStyle(feature, symbology));
                                            },
                                            style: function(feature) {
                                                return $.fn.featureLayer.getStyle(feature, symbology);
                                            },
                                            onEachFeature: function(feature, layer) {
                                            	if(opts._delay){
                                            		window.clearTimeout(opts._delay);
                                            	}
                                            	
                                                var popup = '';
                                                if (typeof(opts.layerPopupTemplate) == "function") {
                                                    popup = opts.layerPopupTemplate(feature.properties);
                                                } else {
                                                    popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                                }
                                                layer.bindPopup(popup);
                                                opts._delay=window.setTimeout(function(){
                                            		deferred.resolve();
                                            	},100);
                                            }
                                        }).addTo($("#" + opts.geoMap)[0].geomap);
                                    },
                                    error: function() {
                                        self.geolayer = L.esri.featureLayer(self.href, {
                                            onEachFeature: function(feature, layer) {
                                                var popup = '';
                                                if (typeof(opts.layerPopupTemplate) == "function") {
                                                    popup = opts.layerPopupTemplate(feature.properties);
                                                } else {
                                                    popup = $.fn.featureLayer.mustache(feature.properties, opts.layerPopupTemplate);
                                                }
                                                layer.bindPopup(popup);
                                            }
                                        }).addTo($("#" + opts.geoMap)[0].geomap);
                                    },
                                    jsonp: 'callback'
                                });
                            }
                        }
                    }
                }
            });
        }
    };

    $.fn.featureLayer._convertEsriOptions = function(esriOptions) {
        var lvectorOptions = {};

        // Check to see if minScale and maxScale are present, if so conver to Google Vector Layers format
        if (!(esriOptions.minScale == undefined || esriOptions.maxScale == undefined)) {
            var minScale = $.fn.featureLayer._scaleToLevel(esriOptions.minScale);
            var maxScale = $.fn.featureLayer._scaleToLevel(esriOptions.maxScale);
            if (maxScale == 0) {
                maxScale = 20;
            }
            lvectorOptions.scaleRange = [minScale, maxScale];
        }

        // Check to see if drawingInfo and rendere are present, if so convert to Google Vector Layers format
        if (esriOptions.drawingInfo && esriOptions.drawingInfo.renderer) {
            lvectorOptions.symbology = $.fn.featureLayer._renderOptionsToSymbology(esriOptions.drawingInfo.renderer);
        }

        // TODO: options.popupTemplate

        return lvectorOptions;
    }


    $.fn.featureLayer._scaleToLevel = function(scale) {
        var agsScales = [591657527.591555, 295828763.795777, 147914381.897889, 73957190.948944, 36978595.474472, 18489297.737236, 9244648.868618, 4622324.434309, 2311162.217155, 1155581.108577, 577790.554289, 288895.277144, 144447.638572, 72223.819286, 36111.909643, 18055.954822, 9027.977411, 4513.988705, 2256.994353, 1128.497176, 564.248588, 282.124294];
        if (scale == 0) {
            return 0;
        }
        var level = 0;
        for (var i = 0; i < agsScales.length - 1; i++) {
            var currentScale = agsScales[i];
            var nextScale = agsScales[i + 1];
            if ((scale <= currentScale) && (scale > nextScale)) {
                level = i;
                break;
            }
        }
        return level;
    }

    $.fn.featureLayer._renderOptionsToSymbology = function(renderOptions) {
        symbology = {};
        switch (renderOptions.type) {
            case "simple":
                symbology.type = "single";
                symbology.vectorOptions = $.fn.featureLayer._parseSymbology(renderOptions.symbol);
                break;

            case "uniqueValue":
                symbology.type = "unique";
                symbology.property = renderOptions.field1; //only support single field uniqueValues rends, rarely see multis anyway
                var values = [];
                for (var i = 0; i < renderOptions.uniqueValueInfos.length; i++) {
                    var uvi = renderOptions.uniqueValueInfos[i];
                    var value = {};
                    value.value = uvi.value;
                    value.vectorOptions = $.fn.featureLayer._parseSymbology(uvi.symbol);
                    value.label = uvi.label; //not in lvector spec yet but useful
                    values.push(value);
                }
                symbology.values = values;
                break;

            case "classBreaks":
                symbology.type = "range";
                symbology.property = renderOptions.field || renderOptions.field1;
                var ranges = [];
                var cbrk = renderOptions.minValue;
                for (var i = 0; i < renderOptions.classBreakInfos.length; i++) {
                    var cbi = renderOptions.classBreakInfos[i];
                    var brk = {};
                    brk.range = [cbrk, cbi.classMaxValue];
                    cbrk = cbi.classMaxValue; //advance
                    brk.vectorOptions = $.fn.featureLayer._parseSymbology(cbi.symbol);
                    brk.label = cbi.label; //not in lvector spec yet but useful
                    ranges.push(brk);
                }
                symbology.ranges = ranges;
                break;
        }
        return symbology;
    }

    $.fn.featureLayer._parseSymbology = function(symbol) {
        var vectorOptions = {};
        switch (symbol.type) {
            case "esriSMS":
            case "esriPMS":
                var customMarker = L.icon({
                    iconUrl: "data:" + symbol.contentType + ";base64," + symbol.imageData,
                    shadowUrl: null,
                    iconSize: new L.Point(symbol.width, symbol.height),
                    iconAnchor: new L.Point((symbol.width / 2) + symbol.xoffset, (symbol.height / 2) + symbol.yoffset),
                    popupAnchor: new L.Point(0, -(symbol.height / 2))
                });
                vectorOptions.icon = customMarker;
                break;

            case "esriSLS":
                //we can only do solid lines in GM (true in latest build?)
                vectorOptions.weight = symbol.width;
                vectorOptions.color = $.fn.featureLayer._parseColor(symbol.color);
                vectorOptions.opacity = $.fn.featureLayer._parseAlpha(symbol.color[3]);
                break;

            case "esriSFS":
                //solid or hollow only
                if (symbol.outline) {
                    vectorOptions.weight = symbol.outline.width;
                    vectorOptions.color = $.fn.featureLayer._parseColor(symbol.outline.color);
                    vectorOptions.opacity = $.fn.featureLayer._parseAlpha(symbol.outline.color[3]);
                } else {
                    vectorOptions.weight = 0;
                    vectorOptions.color = "#000000";
                    vectorOptions.opacity = 0.0;
                }
                if (symbol.style != "esriSFSNull") {
                    vectorOptions.fillColor = $.fn.featureLayer._parseColor(symbol.color);
                    vectorOptions.fillOpacity = $.fn.featureLayer._parseAlpha(symbol.color[3]);
                } else {
                    vectorOptions.fillColor = "#000000";
                    vectorOptions.fillOpacity = 0.0;
                }
                break;
        }
        return vectorOptions;
    }

    $.fn.featureLayer._parseColor = function(color) {
        red = $.fn.featureLayer._normalize(color[0]);
        green = $.fn.featureLayer._normalize(color[1]);
        blue = $.fn.featureLayer._normalize(color[2]);
        return '#' + $.fn.featureLayer._pad(red.toString(16)) + $.fn.featureLayer._pad(green.toString(16)) + $.fn.featureLayer._pad(blue.toString(16));
    }

    $.fn.featureLayer._normalize = function(color) {
        return (color < 1.0 && color > 0.0) ? Math.floor(color * 255) : color;
    }

    $.fn.featureLayer._pad = function(s) {
        return s.length > 1 ? s.toUpperCase() : "0" + s.toUpperCase();
    }

    $.fn.featureLayer._parseAlpha = function(a) {
        // 0-255 -> 0-1.0
        return (a / 255);
    }

    $.fn.featureLayer.mustache = function(obj, str) {
        for (var p in obj) {
            var rex = new RegExp("\{" + p + "\}", "ig");
            str = str.replace(rex, obj[p]);
        }
        return str;
    }

    $.fn.featureLayer.getStyle = function(feature, symbology) {
        //
        // Create an empty vectorOptions object to add to, or leave as is if no symbology can be found
        //
        var vectorOptions = {};

        //
        // Esri calls them attributes. GeoJSON calls them properties.
        //
        var atts = feature.attributes || feature.properties;

        //
        // Is there a symbology set for this layer?
        //
        if (symbology) {
            switch (symbology.type) {
                case "single":
                    //
                    // It's a single symbology for all features so just set the key/value pairs in vectorOptions
                    //
                    for (var key in symbology.vectorOptions) {
                        vectorOptions[key] = symbology.vectorOptions[key];
                        if (vectorOptions.title) {
                            for (var prop in atts) {
                                var re = new RegExp("{" + prop + "}", "g");
                                vectorOptions.title = vectorOptions.title.replace(re, atts[prop]);
                            }
                        }
                    }
                    break;
                case "unique":
                    //
                    // It's a unique symbology. Check if the feature's property value matches that in the symbology and style accordingly
                    //
                    var att = symbology.property;
                    for (var i = 0, len = symbology.values.length; i < len; i++) {
                        if (atts[att] == symbology.values[i].value) {
                            for (var key in symbology.values[i].vectorOptions) {
                                vectorOptions[key] = symbology.values[i].vectorOptions[key];
                                if (vectorOptions.title) {
                                    for (var prop in atts) {
                                        var re = new RegExp("{" + prop + "}", "g");
                                        vectorOptions.title = vectorOptions.title.replace(re, atts[prop]);
                                    }
                                }
                            }
                        }
                    }
                    break;
                case "range":
                    //
                    // It's a range symbology. Check if the feature's property value is in the range set in the symbology and style accordingly
                    //
                    var att = symbology.property;
                    for (var i = 0, len = symbology.ranges.length; i < len; i++) {
                        if (atts[att] >= symbology.ranges[i].range[0] && atts[att] <= symbology.ranges[i].range[1]) {
                            for (var key in symbology.ranges[i].vectorOptions) {
                                vectorOptions[key] = symbology.ranges[i].vectorOptions[key];
                                if (vectorOptions.title) {
                                    for (var prop in atts) {
                                        var re = new RegExp("{" + prop + "}", "g");
                                        vectorOptions.title = vectorOptions.title.replace(re, atts[prop]);
                                    }
                                }
                            }
                        }
                    }
                    break;
            }
        }
        return vectorOptions;
    }

    $.fn.featureLayer.defaults = {
        method: "",
        geoLayerType: "geojson",
        layerTitles: ['lat', 'lng', 'title'],
        layerFieldSeparator: ',',
        layerDeleteQuotes: true,
        layerLineSeparator: "\n",
        layerFirstLineTitles: false,
        layerAgsFields: "*",
        layerAgsUniquefield: "objectid",
        layerAgsUseSymbology: true,
        layerSinglePopup: true,
        layerShowall: false,
        layerScaleRange: "0,20",
        layerDynamic: true,
        layerWhere: "",
        layerPopupTemplate: function(properties) {
            var output = "";
            if (typeof(properties["objectid"]) != "undefined") {
                output = "<h3>" + properties["objectid"] + "</h3>";
            }

            for (var prop in properties) {
                output += prop.replace(/_/gi, " ").replace(/\w\S*/g, function(txt) {
                    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                }) + ": " + properties[prop] + "<br />";
            }
            return output;
        }
    };



    //GeoFeature plugin
    $.fn.geoFeature = function(method) {
        if (this[0].feature && this[0].feature[method]) {
            return this[0].feature[method].apply(this[0].feature, Array.prototype.slice.call(arguments, 1));
        } else if (featuremethods[method]) {
            return featuremethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return featuremethods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on GEO5 geoFeature');
        }
    }

    var featuremethods = {
        destroy: function() {
            return this.each(function() {
                var el = $(this);
                var data = el.data("geo5feature");

                // unbind all events namespaced with .geo5tileLayer
                el.unbind(".geo5feature");

                // remove the main css class
                el.removeClass("geo5feature");

            });

        },

        init: function(options) {
            var opts = $.extend({}, $.fn.geoFeature.defaults, options);

            return this.each(function() {

                var me = $(this);
                var featID = me.attr("id");

                var data = {
                    opts: opts,
                    featureID: featID
                };

                me.data("geo5feature", data);

                //create the feature

            });

        }

    };

    $.fn.geoFeature.defaults = {
        method: "",
        geFeatureType: "Point"
    };
    /* DATA-API HOOKS
     * ================== */
    _includeScript("http://geo5.org/js/leaflet.css.bundle.min.js");
    window._geo5_loadmaps = function() {
        if (typeof(L) !== "undefined") {
            window.setTimeout(_geo5_loadproviders, 150);
            return;
        }
        window.setTimeout(_geo5_loadmaps, 750);
    };
    window._geo5_loadproviders = function() {
        if (typeof(L) !== "undefined" && L.tileLayer && L.tileLayer.provider) {
            $("[data-geo-type='map']").each(function() {
                var $map = $(this);
                $map.geomap($map.data());
            });
            return;
        }
        window.setTimeout(_geo5_loadproviders, 750);
    };
    window.setTimeout(_geo5_loadmaps, 750);
})(jQuery);