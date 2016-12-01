/*
Author: Fiona Waser

All JavaScript code for the Visualization page (Visualization related only).
*/

// use global variables because this script is only used for Visualization page
// and because a lot of functions need real-time information about what the user has chosen

var lowCardinalityThreshold = 50; // threshhold to determine the cardinality of attributes

var tables; // tables in visualization with information
var originalTables; // the tables after sorting
var bridgeTables; // bridge tables if there are any
var bridgeInvolvedTables; // all tables connected by bridge tables
var graph; // graph filled to return join-paths
var matrix; // matrix for chord connections as references between tables
var reference; // references for table connections with information about reference
var attributeCardinalities; // cardinalitites for all attributes
var attributeCardinalitiesPercentages; // cardinalitites for all attributes as percentage
var constraintCardinalities; // cardinalitites for all constraints
var constraintCardinalitiesPercentages; // cardinalitites for all constraints as percentage
var chosenTables; // the tables the user has chosen for the query
var chosenChord; // the chord the user has chosen for the query
var chosenAttributes; // the chosen attributes
var chosenAttributeAggrFunctions; // the chosen aggregate functions
var chosenAttributesOrderBy; // the chosen ordering for the attributes
var histogramChosenValues; // the chosen values in the histogram
var hideBridgeTables; // true if there are bridge tables and the user has chosen to hide them

/*
Initialize all global variables.
*/
function initializeVariables() {
	tables = [];
	originalTables = [];
	bridgeTables = [];
	bridgeInvolvedTables = [];
	graph = [];
	matrix = [];
	references = [];
	attributeCardinalities = [];
	attributeCardinalitiesPercentages = [];
	constraintCardinalities = [];
	constraintCardinalitiesPercentages = [];
	chosenTables = [];
	chosenChord = null;
	chosenAttributes = [];
	chosenAttributeAggrFunctions = [];
	chosenAttributesOrderBy = [];
	histogramChosenValues = [];
	hideBridgeTables = false;
}

/*
Prepares the visualization data and calls to draw the visualization.
*/
function prepareVisualizationData() {
	
	initializeVariables();
	
	// read the structure file
	d3.xml("tables.xml", "application/xml", function(xml) {
		
		// save table information
		tables = xml.getElementsByTagName("table");
		
		// sort tables according to user choice
		var sorting = $('input[name="sortModePath"]:checked').val();
		
		var tablesSortMapping = [];
		for(var i = 0; i < tables.length; i++) {
			if(sorting == "alphabetical") {
				tablesSortMapping[i] = i;
			} else {
				var sortTableLength = tablesSortMapping.length;
				if(sorting == "nrRows") {
					var currentValue = parseFloat(tables[i].children[1].textContent);
						
					var index = 0;
					while((index < sortTableLength) && (currentValue > parseFloat(tables[tablesSortMapping[index]].children[1].textContent))) {
						index++;
					}
					tablesSortMapping.splice(index, 0, i);
				} else if(sorting == "nrFields") {
					var attributesLength = tables[i].children[2].children.length;
						
					var index = 0;
					while((index < sortTableLength) && (attributesLength > tables[tablesSortMapping[index]].children[2].children.length)) {
						index++;
					}
					tablesSortMapping.splice(index, 0, i);
				}
			}
		}
		
		var newTables = [];
		for(var i = 0; i < tablesSortMapping.length; i++) {
			newTables[i] = tables[tablesSortMapping[i]];
		}
		tables = newTables;
		
		// save original tables in case bridge tables will be hidden
		originalTables = tables;
		
		var hasBridgeTables = false;
		for(var i = 0; i < tables.length; i++) {
			if(tables[i].getAttribute("bridgeTable") == 1) {
				hasBridgeTables = true;
			}
		}
		
		if(hasBridgeTables) {
			document.getElementById("showBridgeTables").style.opacity = 1;
			
			document.getElementById("showBridgeTablesCheck").disabled = false;
		}
		
		var showBridgeTablesCheck = document.getElementById("showBridgeTablesCheck").checked;
		
		if(hasBridgeTables && !showBridgeTablesCheck) {
			hideBridgeTables = true;

			var noBridgeTables = [];
			for(var i = 0; i < tables.length; i++) {
				var tablename = originalTables[i].children[0].textContent;
				if(tables[i].getAttribute("bridgeTable") == 1) {
					bridgeTables.push(tables[i]);
					
					var connectingTables = [];
					
					var constraints = tables[i].children[3].children;
					for(var j = 0; j < constraints.length; j++) {
						var referenced_table_name = constraints[j].children[3].textContent;
						
						if(referenced_table_name != "") {
							connectingTables.push(referenced_table_name);
						}
					}
					
					var bridge = [tablename, connectingTables];
					
					bridgeInvolvedTables.push(bridge);
				} else {
					noBridgeTables.push(tables[i]);
				}
			}
			
			tables = noBridgeTables;
		}
		
		var map = {};
		
		if(hideBridgeTables) {
			for(var i = 0; i < originalTables.length; i++) {
				var tablename = originalTables[i].children[0].textContent;
				
				map[tablename] = {};
			}
		}
		
		for(var i = 0; i < tables.length; i++) {
			matrix[i] = [];
				
			references[i] = [];
				
			var tablename = tables[i].children[0].textContent;
			
			if(!hideBridgeTables) { // the automatic join path finder must have all tables, even bridge tables
				map[tablename] = {};
			}
				
			attributeCardinalities[i] = [];
			attributeCardinalitiesPercentages[i] = [];
			chosenAttributes[i] = [];
			chosenAttributeAggrFunctions[i] = [];
			chosenAttributesOrderBy[i] = [];
			histogramChosenValues[i] = [];
				
			var attributes = tables[i].children[2].children;
			for(var k = 0; k < attributes.length; k++) {
				attributeCardinalities[i][k] = "";
				attributeCardinalitiesPercentages[i][k] = "";
				chosenAttributes[i][k] = true;
				chosenAttributeAggrFunctions[i][k] = "None";
				chosenAttributesOrderBy[i][k] = "None";
				histogramChosenValues[i][k] = undefined;
			}
				
			constraintCardinalities[i] = [];
			constraintCardinalitiesPercentages[i] = [];
				
			for(var j = 0; j < tables.length; j++) {
				if(i == j) {
					matrix[i][j] = 1;
				} else {
					matrix[i][j] = 0;
				}
					
				references[i][j] = "";
					
				constraintCardinalities[i][j] = "";
				constraintCardinalitiesPercentages[i][j] = "";
			}
		}
			
		for(var n = 0; n < tables.length; n++) {
			var tablename = tables[n].children[0].textContent;
				
			var attributes = tables[n].children[2].children;
			for(var i = 0; i < attributes.length; i++) {
				var nr_diff_values = attributes[i].children[6].textContent;
				attributeCardinalities[n][i] = nr_diff_values;
				attributeCardinalitiesPercentages[n][i] = nr_diff_values / tables[n].children[1].textContent;
			}
				
			var constraints = tables[n].children[3].children;
			for(var j = 0; j < constraints.length; j++) {
				var column_name = constraints[j].children[0].textContent;
				var constraint_name = constraints[j].children[1].textContent;
				var referenced_column_name = constraints[j].children[2].textContent;
				var referenced_table_name = constraints[j].children[3].textContent;
				
				if(referenced_table_name != "") {
					var nr_diff_column_values = constraints[j].children[4].textContent;
					constraintCardinalities[n][j] += nr_diff_column_values+" ";
						
					for(var k = 0; k < tables.length; k++) {
						var tablenameSearch = tables[k].children[0].textContent;
						if(referenced_table_name == tablenameSearch) {
							map[tablename][referenced_table_name] = 1;
							map[referenced_table_name][tablename] = 1;
							
							matrix[n][k] = matrix[n][k] + 1;
							
							old_references = references[n][k];
									
							var attributesSearch = tables[k].children[2].children;
							for(var m = 0; m < attributesSearch.length; m++) {
								if(referenced_column_name == attributesSearch[m].children[0].textContent) {
									var nr_diff_valuesSearch = attributesSearch[m].children[6].textContent;
								}
										
							}
							constraintCardinalitiesPercentages[n][k] += (nr_diff_column_values / nr_diff_valuesSearch)+" ";
							var percentage = constraintCardinalitiesPercentages[n][k] * 100;
								
							var cardinality = constraintCardinalities[n][j];
							var cardinalityPercent = (nr_diff_column_values / nr_diff_valuesSearch)*100;
							if(old_references == "") {
								references[n][k] = "PK: "+referenced_table_name+"."+referenced_column_name+" <- FK: "+tablename+"."+column_name+", Constraint: "+constraint_name+" ("+formatNumber(cardinality)+" ~ "+formatNumber(cardinalityPercent)+"%)";
							} else {
								references[n][k] = old_references.concat("\nPK: "+referenced_table_name+"."+referenced_column_name+" <- FK: "+tablename+"."+column_name+", Constraint: "+constraint_name+" ("+formatNumber(cardinality)+" ~ "+formatNumber(cardinalityPercent)+"%)");
							}
						}
					}
				} else {
					pk_column = column_name;
				}
			}
			
			if(hideBridgeTables) {
				for(var i = 0; i < bridgeInvolvedTables.length; i++) {
					var bridgeTablename = bridgeInvolvedTables[i][0];
					var bridgeTablesConnect = bridgeInvolvedTables[i][1];
					
					if(jQuery.inArray(tablename, bridgeTablesConnect) != -1) {
						for(var j = 0; j < bridgeTablesConnect.length; j++) {
							if(tablename != bridgeTablesConnect[j]) {
								for(var l = 0; l < tables.length; l++) {
									
									if(tables[l].children[0].textContent == bridgeTablesConnect[j]) {
										matrix[n][l] = matrix[n][l] + 1;
										
										for(var o = 0; o < bridgeTables.length; o++) {
											if(bridgeTables[o].children[0].textContent == bridgeTablename) {
												var nr_rowsBridge = bridgeTables[o].children[1].textContent;
												
												var constraintsBridge = bridgeTables[o].children[3].children;
												
												var bridge_referenced_column_name = "";
												var bridge_referenced_table_name = "";
												for(var p = 0; p < constraintsBridge.length; p++) {
													
													var column_name = constraintsBridge[p].children[0].textContent;
													var bridge_referenced_column_name = constraintsBridge[p].children[2].textContent;
													var bridge_referenced_table_name = constraintsBridge[p].children[3].textContent;
												}
												
												var column_name = "";
												for(var p = 0; p < constraintsBridge.length; p++) {
													if(constraintsBridge[p].children[3].textContent == tablename) {
														column_name = constraintsBridge[p].children[0].textContent;
													}
												}
												
												constraintCardinalities[n][l] += nr_rowsBridge+" ";
												constraintCardinalitiesPercentages[n][l] += 1+" ";
												var percentage = constraintCardinalitiesPercentages[n][l] * 100;
															
												var cardinality = constraintCardinalities[n][l];
												var cardinalityPercent = 100;
														
												references[n][l] = "PK: "+bridge_referenced_table_name+"."+bridge_referenced_column_name+" <-> PK: "+tablename+"."+pk_column+", Bridge Table: "+bridgeTablename+" ("+formatNumber(cardinality)+" ~ "+formatNumber(cardinalityPercent)+"%)";
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
		
		if(hideBridgeTables) {
			for(var i = 0; i < bridgeInvolvedTables.length; i++) {
				var bridgeTablename = bridgeInvolvedTables[i][0];
				var bridgeTablesConnect = bridgeInvolvedTables[i][1];
				
				for(var j = 0; j < bridgeTablesConnect.length; j++) {
					map[bridgeTablesConnect[j]][bridgeTablename] = 0.5;
					map[bridgeTablename][bridgeTablesConnect[j]] = 0.5;
				}
			}
		}
		
		graph = new Graph(map);
		
		drawDiagram();
	});
}

/*
Draws the chord diagram and related legends according to the set arrays.
*/
function drawDiagram() {
	clearElement("#legendCardinalityGradient");
	clearElement("#legendNrRowsGradient");
	clearElement("#diagram");
	
	var diagramWidth = $(window).width()/2-20;
	
	var width = diagramWidth,
		height = 800,
		outerRadius = Math.min(width, height) / 2 - 50,
		innerRadius = outerRadius - 62;
		
	// detect keydown event
	d3.select("body").on("keydown", function() {});
	
	// add sv to div
	var svg = d3.select("#diagram").append("svg")
		.attr("width", width)
		.attr("height", height)
		.append("g")
		.attr("id", "circle")
		.style("font", "12px sans-serif")
		.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
		
	// color picker for nr. rows
	var density_color_picker = d3.scale.linear()
		.domain([0, tables.length-1])
		.range(["white", "black"]);
		
	// create ranking for density colors to make color difference between tables bigger
	var nr_rows_ordered_values = [];
	var values_nr_rows_domain = [];
	for(var n = 0; n < tables.length; n++) {
		var current_value = parseFloat(tables[n].children[1].textContent);
		
		if(values_nr_rows_domain.length == 0) {
			values_nr_rows_domain.push(n);
			nr_rows_ordered_values.push(current_value);
		} else {
			var index = 0;
			while(current_value >= nr_rows_ordered_values[index] && index < values_nr_rows_domain.length) {
				index++;
			}
			values_nr_rows_domain.splice(index, 0, n);
			nr_rows_ordered_values.splice(index, 0, current_value);
		}
	}
	var values_nr_rows_range = [];
	for(var n = 0; n < tables.length; n++) {
		values_nr_rows_range[n] = density_color_picker(n);
	}
	
	// new color picker for nr. rows
	var density_colors = d3.scale.linear()
		.domain(values_nr_rows_domain)
		.range(values_nr_rows_range);
	
	// colors for cardianlity number (percentage)
	var cardinality_colors = d3.scale.linear()
		.domain([0, 1, 1.01, 2])
		.range(["white", "darkblue", "red", "darkred"]);
			
	var arc = d3.svg.arc()
		.innerRadius(innerRadius)
		.outerRadius(outerRadius-40);
			
	var layout = d3.layout.chord()
		.padding(.04);

	var path = d3.svg.chord()
		.radius(innerRadius);

	// draw circle
	svg.append("circle")
		.style("fill", "none")
		.style("pointer-events", "all")
		.attr("r", outerRadius-40);

	// create layout of diagram using the matrix
	layout.matrix(matrix);

	var group = svg.selectAll(".group")
		.data(layout.groups)
		.enter().append("g")
		.attr("class", "group")
		.on("mouseover", function(d, i) {
			chord.classed("fade", function(p) {
				return p.source.index != i && p.target.index != i;
			})
		});

	// add tablename and nr. rows as tooltip 
	group.append("title").text(function(d, i) {
		var number = parseFloat(tables[i].children[1].textContent);
		if(number == 1) {
			return tables[i].children[0].textContent+" ("+formatNumber(number)+" row)";	
		} else {
			return tables[i].children[0].textContent+" ("+formatNumber(number)+" rows)";
		}
	});

	// draw parts of the circle according to layout
	var groupPath = group.append("path")
		.attr("id", function(d, i) { return "group" + d.index; })
		.attr("d", arc)
		.style("fill", function(d, i) { return values_nr_rows_range[values_nr_rows_domain.indexOf(d.index)]; })
		.style("fill-opacity", ".5")
		.style("stroke", "black")
		.style("stroke-width", ".25px")
		.on("click", function(d) {
			showAttributeInfo(d.index);
			
			if(d3.event.ctrlKey) {
				chosenChord = null;
				
				if(jQuery.inArray(d.index, chosenTables) != -1) {
					var removeIndex = chosenTables.indexOf(d.index);
					chosenTables.splice(removeIndex, 1);
				} else {
					chosenTables.push(d.index);
				}
				
				$(".group path").css("stroke-width", ".25px");
				$(".group path").css("stroke", "black");
				
				for(var i = 0; i < chosenTables.length; i++) {
					$(".group:eq("+chosenTables[i]+") path").css("stroke-width", "4.5px");
					$(".group:eq("+chosenTables[i]+") path").css("stroke", "gold");
				}
				
				showRows();
			}
		})
		.on("mouseover", function(d) {
			d3.select(this).style("cursor", "pointer");
			$(".group:eq("+d.index+") text").css("font-weight", "bold");
			$(".group:eq("+d.index+") text").css("font-size", "15px");
		})
		.on("mouseout", function(d) {
			d3.select(this).style("cursor", "default");
			$(".group:eq("+d.index+") text").css("font-weight", "normal");
			$(".group:eq("+d.index+") text").css("font-size", "12px");
		});
			
	// add tablename as text outside of circle to save space for a lot of tables per circle
	var groupText = group.append("text")
		.each(function(d) { d.angle = (d.startAngle + d.endAngle) / 2; })
		.attr("dy", ".35em")
		.attr("transform", function(d) {
			return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
				+ "translate(" + (innerRadius + 30) + ")"
				+ (d.angle > Math.PI ? "rotate(180)" : "");
		})
		.style("text-anchor", function(d) { return d.angle > Math.PI ? "end" : null; })
		.text(function(d, i) { return tables[i].children[0].textContent; })
		.on("click", function(d) {
			showAttributeInfo(d.index);
			
			if(d3.event.ctrlKey) {
				chosenChord = null;
				
				if(jQuery.inArray(d.index, chosenTables) != -1) {
					var removeIndex = chosenTables.indexOf(d.index);
					chosenTables.splice(removeIndex, 1);
				} else {
					chosenTables.push(d.index);
				}
				
				$(".group path").css("stroke-width", ".25px");
				$(".group path").css("stroke", "black");
				
				for(var i = 0; i < chosenTables.length; i++) {
					$(".group:eq("+chosenTables[i]+") path").css("stroke-width", "4.5px");
					$(".group:eq("+chosenTables[i]+") path").css("stroke", "gold");
				}
				
				showRows();
			}
		})
		.on("mouseover", function(d) {
			d3.select(this).style("cursor", "pointer");
			d3.select(this).style("font-weight", "bold");
			d3.select(this).style("font-size", "15px");
		})
		.on("mouseout", function(d) {
			d3.select(this).style("cursor", "default");
			d3.select(this).style("font-weight", "normal");
			d3.select(this).style("font-size", "12px");
		});

	// add chords (references of tables from matrix)
	// important: all tables in matrix have at least one self-reference to make the part of the circle bigger,
	// but as they are false information, they are filtered, but self references are still possible
	var chord = svg.selectAll(".chord")
		.data(layout.chords)
		.enter().append("path")
		.attr("class", "chord")
		.style("fill", function(d) {
			return cardinality_colors(getCardinalityCumulatedPercentage(d.source.index, d.target.index));
		})
		.style("opacity", function(d) {
			if(d.source.index != d.target.index || (d.source.index == d.target.index && matrix[d.source.index][d.target.index] > 1)) {
				return "1";
			} else {
				return "0";
			}
		})
		.attr("d", path)
		.style("stroke", "#000")
		.style("stroke-width", ".25px")
		.on("click", function(d) {
			if(d.source.index != d.target.index || (d.source.index == d.target.index && matrix[d.source.index][d.target.index] > 1)) {
				chosenChord = d;
				
				if(chosenChord != null) {
					chosenTables = [chosenChord.source.index, chosenChord.target.index];
				}
				
				showAttributeInfo(chosenChord.source.index);
				
				if(d3.event.ctrlKey) {
					$(".group path").css("stroke-width", ".25px");
					$(".group path").css("stroke", "black");
					
					$(".group:eq("+chosenChord.source.index+") path").css("stroke-width", "4.5px");
					$(".group:eq("+chosenChord.source.index+") path").css("stroke", "gold");
					$(".group:eq("+chosenChord.target.index+") path").css("stroke-width", "4.5px");
					$(".group:eq("+chosenChord.target.index+") path").css("stroke", "gold");
					
					showRows();
				}
			}
		})
		.on("mouseover", function(d) {
			if(d.source.index != d.target.index || (d.source.index == d.target.index && matrix[d.source.index][d.target.index] > 1)) {
				d3.select(this).style("cursor", "pointer");
				
				$(".group:eq("+d.source.index+") text").css("font-weight", "bold");
				$(".group:eq("+d.target.index+") text").css("font-weight", "bold");
				$(".group:eq("+d.source.index+") text").css("font-size", "15px");
				$(".group:eq("+d.target.index+") text").css("font-size", "15px");
			}
		}).on("mouseout", function(d) {
			if(d.source.index != d.target.index || (d.source.index == d.target.index && matrix[d.source.index][d.target.index] > 1)) {
				d3.select(this).style("cursor", "default");
				
				$(".group:eq("+d.source.index+") text").css("font-weight", "normal");
				$(".group:eq("+d.target.index+") text").css("font-weight", "normal");
				$(".group:eq("+d.source.index+") text").css("font-size", "12px");
				$(".group:eq("+d.target.index+") text").css("font-size", "12px");
			}
		});

	// add info for chord (references) as tooltip
	chord.append("title").text(function(d) {
		if(d.source.index != d.target.index || (d.source.index == d.target.index && matrix[d.source.index][d.target.index] > 1)) {
			return references[d.source.index][d.target.index];
		}
	});
	
	// this next part consists of drawing the legends only
	var gradientWidth = 250;
	var gradientHeight = 20;
	var gradientYMin = 0;
	var gradientXCardinality = $("#legendCardinality").width()/2-gradientWidth/2;
	var gradientXNrRows = $("#legendNrRows").width()/2-gradientWidth/2;
	
	var legendCardinalityTitle = document.getElementById('legendCardinalityTitle');
	legendCardinalityTitle.style.margin = "auto";
	legendCardinalityTitle.style.textAlign = "center";
	legendCardinalityTitle.style.width = gradientWidth;
	legendCardinalityTitle.style.height = gradientHeight;
	
	var legendCardinalityGradient = document.getElementById('legendCardinalityGradient');
	legendCardinalityGradient.style.position = "relative";
	legendCardinalityGradient.style.width = gradientWidth;
	legendCardinalityGradient.style.height = gradientHeight;
	legendCardinalityGradient.style.left = gradientXCardinality+'px';
	legendCardinalityGradient.style.top = gradientYMin+'px';
	legendCardinalityGradient.style.border = "thin solid black";
	
	var gradientCardinality = d3.select("#legendCardinalityGradient").append("svg")
		.attr("width", gradientWidth)
		.attr("height", gradientHeight);
	
	var gradCardinality = gradientCardinality.append("defs")
		.append("linearGradient")
			.attr("id", "cardinalityGradient")
			.attr("x1", 0)
			.attr("y1", 0)
			.attr("x2", "100%")
			.attr("y2", 0)
			.attr("spreadMethod", "repeat");
		
	gradCardinality.append("stop")
		.attr("offset", "0%")
		.attr("stop-color", cardinality_colors(0))
		.attr("stop-opacity", 1);
		
	gradCardinality.append("stop")
		.attr("offset", "50%")
		.attr("stop-color", cardinality_colors(1))
		.attr("stop-opacity", 1);
		
	gradCardinality.append("stop")
		.attr("offset", "51%")
		.attr("stop-color", cardinality_colors(1.01))
		.attr("stop-opacity", 1);

	gradCardinality.append("stop")
		.attr("offset", "100%")
		.attr("stop-color", cardinality_colors(2))
		.attr("stop-opacity", 1);
		
	gradientCardinality.append("rect")
		.attr("width", gradientWidth)
		.attr("height", gradientHeight)
		.style("fill", "url(#cardinalityGradient)");
	
	var legendCardinalityLegend = document.getElementById('legendCardinalityLegend');
	legendCardinalityLegend.style.width = "100%";
	legendCardinalityLegend.style.height = gradientHeight;
	
	var legendCardinalityLegend0 = document.getElementById('legendCardinalityLegend0');
	legendCardinalityLegend0.innerHTML = "0%";
	legendCardinalityLegend0.style.marginLeft = gradientXCardinality+'px';
	legendCardinalityLegend0.style.width = gradientWidth/3;
	legendCardinalityLegend0.style.height = gradientHeight;
	legendCardinalityLegend0.style.display = "inline-block";
	
	var legendCardinalityLegend1 = document.getElementById('legendCardinalityLegend1');
	legendCardinalityLegend1.innerHTML = "100%";
	legendCardinalityLegend1.style.width = gradientWidth/3;
	legendCardinalityLegend1.style.height = gradientHeight;
	legendCardinalityLegend1.style.display = "inline-block";
	legendCardinalityLegend1.style.margin = "auto";
	legendCardinalityLegend1.style.textAlign = "center";
	
	var legendCardinalityLegend2 = document.getElementById('legendCardinalityLegend2');
	legendCardinalityLegend2.innerHTML = "200%";
	legendCardinalityLegend2.style.width = gradientWidth/3;
	legendCardinalityLegend2.style.verticalAlign = "top";
	legendCardinalityLegend2.style.height = gradientHeight;
	legendCardinalityLegend2.style.display = "inline-block";
	legendCardinalityLegend2.style.margin = "auto";
	legendCardinalityLegend2.style.textAlign = "right";
	
	var legendNrRowsGradient = document.getElementById('legendNrRowsGradient');
	legendNrRowsGradient.style.position = "relative";
	legendNrRowsGradient.style.width = gradientWidth;
	legendNrRowsGradient.style.height = gradientHeight;
	legendNrRowsGradient.style.left = gradientXNrRows+'px';
	legendNrRowsGradient.style.top = gradientYMin+'px';
	legendNrRowsGradient.style.border = "thin solid black";
	
	var legendCardinalityTitle = document.getElementById('legendNrRowsTitle');
	legendCardinalityTitle.style.margin = "auto";
	legendCardinalityTitle.style.textAlign = "center";
	legendCardinalityTitle.style.width = gradientWidth;
	legendCardinalityTitle.style.height = gradientHeight;
	
	var gradientNrRows = d3.select("#legendNrRowsGradient").append("svg")
		.attr("width", gradientWidth)
		.attr("height", gradientHeight);
	
	var gradNrRows = gradientNrRows.append("defs")
		.append("linearGradient")
			.attr("id", "nrRowsGradient")
			.attr("x1", 0)
			.attr("y1", 0)
			.attr("x2", "100%")
			.attr("y2", 0)
			.attr("spreadMethod", "repeat");
		
	gradNrRows.append("stop")
		.attr("offset", "0%")
		.attr("stop-color", values_nr_rows_range[0])
		.attr("stop-opacity", 1);

	gradNrRows.append("stop")
		.attr("offset", "100%")
		.attr("stop-color", values_nr_rows_range[values_nr_rows_range.length-1])
		.attr("stop-opacity", 1);
		
	gradientNrRows.append("rect")
		.attr("width", gradientWidth)
		.attr("height", gradientHeight)
		.style("fill", "url(#nrRowsGradient)");
			
	var legendNrRowsLegend0 = document.getElementById('legendNrRowsLegend0');
	legendNrRowsLegend0.innerHTML = formatNumber(nr_rows_ordered_values[0]);
	legendNrRowsLegend0.style.marginLeft = gradientXCardinality+'px';
	legendNrRowsLegend0.style.width = gradientWidth/2;
	legendNrRowsLegend0.style.height = gradientHeight;
	legendNrRowsLegend0.style.display = "inline-block";
	
	var legendNrRowsLegend1 = document.getElementById('legendNrRowsLegend1');
	legendNrRowsLegend1.innerHTML = formatNumber(nr_rows_ordered_values[nr_rows_ordered_values.length-1]);
	legendNrRowsLegend1.style.width = gradientWidth/2;
	legendNrRowsLegend1.style.verticalAlign = "top";
	legendNrRowsLegend1.style.height = gradientHeight;
	legendNrRowsLegend1.style.display = "inline-block";
	legendNrRowsLegend1.style.margin = "auto";
	legendNrRowsLegend1.style.textAlign = "right";
}

/*
Calculates and returns the cumulated percentage of the reference.

A reference can have more than one constraint cardinality if the tables have multiple constraints between them.
In this case, the average percentage is taken.

Parameters:
sourceIndex = index of source of chord/reference
targetIndex = index of target of chord/reference
*/
function getCardinalityCumulatedPercentage(sourceIndex, targetIndex) {
	var values = constraintCardinalitiesPercentages[sourceIndex][targetIndex].split(" ");
	var valuesSum = 0;
	for(var i = 0; i < (values.length-1); i++) {
		valuesSum += parseFloat(values[i]);
	}
	var cumulatedPercentage = valuesSum / (values.length-1);
	
	return cumulatedPercentage;
}

/*
Toggle chosen attribute.

Parameters:
tableIndex = index of table
attributeIndex = index of attribute
*/
function setAttributeChosen(tableIndex, attributeIndex) {
	if(chosenAttributes[tableIndex][attributeIndex]) {
		chosenAttributes[tableIndex][attributeIndex] = false;
	} else {
		chosenAttributes[tableIndex][attributeIndex] = true;
	}
}

/*
Set chosen aggregate function for attribute.

Parameters:
tableIndex = index of table
attributeIndex = index of attribute
func = chosen aggregate function
*/
function setAggrFunctionChosen(tableIndex, attributeIndex, func) {
	chosenAttributeAggrFunctions[tableIndex][attributeIndex] = func;
}

/*
Check if aggregate function was chosen.

Parameters:
tableIndex = index of table
attributeIndex = index of attribute

Returns true if aggregate function was chosen, else false.
*/
function checkAggrFunctionChosen(tableIndex, attributeIndex) {
	if(chosenAttributeAggrFunctions[tableIndex][attributeIndex] == "None") {
		return false;
	} else {
		return true;
	}
}

/*
Check if order by function was set for attribute.

Parameters:
tableIndex = index of table
attributeIndex = index of attribute
Returns true if order by function was chosen, else false.

*/
function checkChosenAttributesOrderBy(tableIndex, attributeIndex) {
	if(chosenAttributesOrderBy[tableIndex][attributeIndex] == "None") {
		return false;
	} else {
		return true;
	}
}

/*
Sets the chosen order by function.

Parameters:
tableIndex = index of table
attributeIndex = index of attribute
order = chosen order fuction
*/
function setChosenAttributesOrderBy(tableIndex, attributeIndex, order) {
	chosenAttributesOrderBy[tableIndex][attributeIndex] = order;
}

/*
Show Attribute infor for the chosen table.

Parameters:
index = index of chosen table
*/
function showAttributeInfo(index) {
	clearElement("#attributeInfo");
	
	var table = tables[index];
	
	var tablename = table.firstChild.textContent;
	
	var attributes = table.children[2].children;
	
	var content = "<p><h2>"+tablename+"</h2>";
	content += "<table id='attributesTable'>";
	
	var chooseAllAttributes = "<input type='checkbox' id='attributeChooserAll' name='attributeChooserAll' onclick='toggleAllAttributes(this);' checked='checked'>";
	
	content += "<tr><th>"+chooseAllAttributes+"</th><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th><th>Unit</th><th>Cardinality</th><th></th><th>AggFunction</th><th>OrderBy</th></tr>";
	
	var aggregateFunctions = getAggregateFunctions();
	var orderByFunctions = getOrderByFunctions();
	
	for(var j = 0; j < attributes.length; j++) {
		var field = attributes[j].children[0].textContent;
		var type = attributes[j].children[1].textContent;
		var null_ = attributes[j].children[2].textContent;
		var key = attributes[j].children[3].textContent;
		var default_ = attributes[j].children[4].textContent;
		var extra = attributes[j].children[5].textContent;
		var unit = "";
		
		if(attributes[j].attributes.length != 0) {
			var unitAttribute = attributes[j].attributes[0].nodeValue;
			
			if(unitAttribute == "money") {
				unit = "Money";
			}
		}
		
		var cardinalityInfo = "";
		var percent = attributeCardinalitiesPercentages[index][j]*100;
		var attrCardinality = parseFloat(attributeCardinalities[index][j]);
		if(attrCardinality <= lowCardinalityThreshold && key != "PRI") {
			cardinalityInfo = "low ("+formatNumber(attrCardinality)+" - "+formatNumber(percent)+"%)";
		} else {
			cardinalityInfo = "high ("+formatNumber(attrCardinality)+" - "+formatNumber(percent)+"%)";
		}
		
		var fullRectWidth = 150;
		var rowHeight = 20;
		var barWidth = fullRectWidth * attributeCardinalitiesPercentages[index][j];
		var svg = "<svg width='"+fullRectWidth+"' height='"+rowHeight+"'><rect width='"+barWidth+"' height='"+rowHeight+"' style='fill: steelblue;' /></svg>";
		
		var choserContent = "<td>";
		if(chosenAttributes[index][j]) {
			choserContent += "<input type='checkbox' name='attributeChooser_"+index+"_"+j+"' class='attributeChooserClass' value='"+field+"' onclick='toggleOneAttribute(this); setAttributeChosen("+index+", "+j+"); showRows();' checked='checked'>";
		} else {
			choserContent += "<input type='checkbox' name='attributeChooser_"+index+"_"+j+"' class='attributeChooserClass' value='"+field+"' onclick='toggleOneAttribute(this); setAttributeChosen("+index+", "+j+"); showRows();'>";
		}
		choserContent += "</td>";
		
		var aggFunctionsHtml = "<select name='chooseAggFunctions' onclick='setAggrFunctionChosen("+index+", "+j+", this.value); showRows();'>";
		for(var i = 0; i < aggregateFunctions.length; i++) {
			aggFunctionsHtml += "<option value='"+aggregateFunctions[i]+"'>"+aggregateFunctions[i]+"</option>";
		}
		aggFunctionsHtml += "</select>";
		
		var choserContentOrder = "<select name='chooseOrderByFunctions' onclick='setChosenAttributesOrderBy("+index+", "+j+", this.value); showRows();'>";
		for(var i = 0; i < orderByFunctions.length; i++) {
			choserContentOrder += "<option value='"+orderByFunctions[i]+"'>"+orderByFunctions[i]+"</option>";
		}
		choserContentOrder += "</select>";
		
		var histogramChooser = "<div onclick='prepareHistogram("+index+", &quot;"+tablename+"&quot;, &quot;"+field+"&quot;, "+j+", &quot;&quot;);' class='histogramIcon'>&nbsp;</div>";
		
		content += "<tr>"+choserContent+"<td>"+field+"</td><td>"+type+"</td><td>"+null_+"</td><td>"+key+"</td><td>"+default_+"</td><td>"+extra+"</td><td>"+unit+"</td><td>"+svg+"</br> "+cardinalityInfo+"</td><td>"+histogramChooser+"</td><td>"+aggFunctionsHtml+"</td><td>"+choserContentOrder+"</td></tr>";
	}
	
	content += "</table></p>";

	document.getElementById("attributeInfo").innerHTML = content;
}

/*
Toggle checkbock for all attributes.

Parameters:
source = source element the call came from
*/
function toggleAllAttributes(source) {
	var attributesBoxes = document.getElementsByClassName("attributeChooserClass");
	
	var allChecked = true;
	for(var i = 0; i < attributesBoxes.length; i++) {
		if(!attributesBoxes[i].checked) {
			allChecked = false;
		}
	}
	
	if(allChecked) {
		if(source.checked) {
			for(var i = 0; i < attributesBoxes.length; i++) {
				attributesBoxes[i].checked = true;
			}
		} else {
			for(var i = 0; i < attributesBoxes.length; i++) {
				attributesBoxes[i].checked = false;
			}
		}
	} else {
		if(source.checked) {
			for(var i = 0; i < attributesBoxes.length; i++) {
				attributesBoxes[i].checked = true;
			}
		}
	}
	
	showRows();
}

/*
Toggle checkbock for one attribute.

Parameters:
source = source element the call came from
*/
function toggleOneAttribute(source) {
	var allBox = document.getElementById("attributeChooserAll");
	
	if(!source.checked) {
		allBox.checked = false;
	} else {
		var attributesBoxes = document.getElementsByClassName("attributeChooserClass");
		var allChecked = true;
		for(var i = 0; i < attributesBoxes.length; i++) {
			if(!attributesBoxes[i].checked) {
				allChecked = false;
			}
		}
		
		if(allChecked) {
			allBox.checked = true;
		} else {
			allBox.checked = false;
		}
	}
}

/*
This functions checks for user choices, then builds the query, executes it and shows the results.
*/
function showRows() {
	if(chosenTables.length > 0) {
		var chosenAttributesAll = true;
		for(var i = 0; i < chosenAttributes.length; i++) {
			for(var j = 0; j < chosenAttributes[i].length; j++) {
				if(!chosenAttributes[i][j]) {
					chosenAttributesAll = false;
					
					break;
				}
			}
		}
		
		var chosenAttributeAggrFunctionsEmpty = true;
		for(var i = 0; i < chosenAttributeAggrFunctions.length; i++) {
			for(var j = 0; j < chosenAttributeAggrFunctions[i].length; j++) {
				if(checkAggrFunctionChosen(i, j)) {
					chosenAttributeAggrFunctionsEmpty = false;
					
					break;
				}
			}
		}
		
		var chosenAttributesOrderByEmpty = true;
		for(var i = 0; i < chosenAttributesOrderBy.length; i++) {
			for(var j = 0; j < chosenAttributesOrderBy[i].length; j++) {
				if(checkChosenAttributesOrderBy(i, j)) {
					chosenAttributesOrderByEmpty = false;
					
					break;
				}
			}
		}
		
		var histogramChosenValuesEmpty = true;
		for(var i = 0; i < histogramChosenValues.length; i++) {
			for(var j = 0; j < histogramChosenValues[i].length; j++) {
				if(histogramChosenValues[i][j] != undefined) {
					histogramChosenValuesEmpty = false;
					
					break;
				}
			}
		}
		
		var flagAll = false;
		if(chosenAttributesAll && chosenAttributeAggrFunctionsEmpty) {
			flagAll = true;
		}
		
		var path = [];
		var pathAliases = [];
		var attributesQuery = "";
		var tablesQuery = "";
		var tablesQueryVisual = "";
		var joins = "ON ";
		var joinsVisual = "<span class='queryControlWords'>ON</span> ";
		var order = "ORDER BY ";
		var orderVisual = "<span class='queryControlWords'>ORDER BY</span> ";
		var where = "WHERE ";
		var whereVisual = "<span class='queryControlWords'>WHERE</span> ";
		
		if(chosenTables.length == 1) {
			var index = chosenTables[0];
			var table = tables[index];
			var tablename = table.firstChild.textContent;
			tablesQuery = tablename;
			tablesQueryVisual = tablename;
			
			if(flagAll) {
				attributesQuery = "*";
			} else {
				var attributes = table.children[2].children;
				for(var p = 0; p < attributes.length; p++) {
					if(chosenAttributes[index][p] && checkAggrFunctionChosen(index, p)) {
						attributesQuery += chosenAttributeAggrFunctions[index][p]+"("+attributes[p].firstChild.textContent+"), ";
					} else if(chosenAttributes[index][p]) {
						attributesQuery += attributes[p].firstChild.textContent+", ";
					} else if(checkAggrFunctionChosen(index, p)) {
						attributesQuery += chosenAttributeAggrFunctions[index][p]+"("+attributes[p].firstChild.textContent+"), ";
					}
				}
				attributesQuery = attributesQuery.substring(0, attributesQuery.length-2);
			}
			
			joins = "";
			joinsVisual = "";
			
			if(chosenAttributesOrderByEmpty) {
				order = "";
				orderVisual = "";
			} else {
				var attributes = table.children[2].children;
				for(var p = 0; p < attributes.length; p++) {
					if(checkChosenAttributesOrderBy(index, p)) {
						order += attributes[p].firstChild.textContent+" "+chosenAttributesOrderBy[index][p]+", ";
						orderVisual += attributes[p].firstChild.textContent+" <span class='queryControlWords'>"+chosenAttributesOrderBy[index][p]+"</span>, ";
					}
				}
				order = order.substring(0, order.length-2);
				orderVisual = orderVisual.substring(0, orderVisual.length-2);
			}
			
			if(histogramChosenValuesEmpty) {
				where = "";
				whereVisual = "";
			} else {
				var attributes = table.children[2].children;
				for(var p = 0; p < attributes.length; p++) {
					if(histogramChosenValues[index][p] != undefined) {
						var type = attributes[p].children[1].textContent;
						if(isSqlTypNumber(type)) {
							where += attributes[p].firstChild.textContent+" = "+histogramChosenValues[index][p];
							whereVisual += attributes[p].firstChild.textContent+" = "+histogramChosenValues[index][p];
						} else {
							where += attributes[p].firstChild.textContent+" = '"+histogramChosenValues[index][p]+"'";
							whereVisual += attributes[p].firstChild.textContent+" = '"+histogramChosenValues[index][p]+"'";
						}
					}
				}
			}
		} else if(chosenTables.length > 1) {
			for(var i = 0; i < chosenTables.length; i++) {
				if(i < chosenTables.length-1) {
					var sourceTable = tables[chosenTables[i]];
					var sourceTablename = sourceTable.firstChild.textContent;
					var targetTable = tables[chosenTables[i+1]];
					var targetTablename = targetTable.firstChild.textContent;
					
					var currentPath = graph.findShortestPath(sourceTablename, targetTablename);
					
					var currentAliases = [];
					for(var n = 0; n < currentPath.length; n++) {
						var firstChar = currentPath[n].substring(0,1);
						if($.inArray(firstChar, currentAliases) > -1 || $.inArray(firstChar, pathAliases) > -1) {
							var uniqueFound = false;
							for(var l = 65; l < 91; l++) {
								if(!uniqueFound) {
									var add = String.fromCharCode(l);
									var addLower = add.toLowerCase();
									var newAdd = firstChar+addLower;
									if($.inArray(newAdd, currentAliases) == -1 && $.inArray(newAdd, pathAliases) == -1) {
										uniqueFound = true;
										currentAliases[n] = newAdd;
										
										break;
									}
								}
							}
						} else {
							currentAliases[n] = firstChar;
						}
					}
					if(path.length == 0) {
						path = currentPath;
						pathAliases = currentAliases;
					} else {
						path.pop();
						pathAliases.pop();
						for(var j = 0; j < currentPath.length; j++) {
							path.push(currentPath[j]);
							pathAliases.push(currentAliases[j]);
						}
					}
				}
			}
			
			var constraintCounter = 0;
			for(var i = 0; i < path.length; i++) {
				var pathTable = path[i];
				var pathTableAlias = pathTable+" "+pathAliases[i];
				tablesQuery += pathTableAlias;
				tablesQueryVisual += pathTableAlias;
				
				for(var j = 0; j < originalTables.length; j++) {
					var table = originalTables[j];
					var tableName = table.firstChild.textContent;
					
					if(pathTable == tableName) {
						
						if(flagAll) {
							attributesQuery = "*";
						} else {
							var attributes = table.children[2].children;
							for(var p = 0; p < attributes.length; p++) {
								if(chosenAttributes[j][p] && checkAggrFunctionChosen(j, p)) {
									attributesQuery += chosenAttributeAggrFunctions[j][p]+"("+pathAliases[i]+"."+attributes[p].firstChild.textContent+"), ";
								} else if(chosenAttributes[j][p]) {
									attributesQuery += pathAliases[i]+"."+attributes[p].firstChild.textContent+", ";
								} else if(checkAggrFunctionChosen(j, p)) {
									attributesQuery += chosenAttributeAggrFunctions[j][p]+"("+pathAliases[i]+"."+attributes[p].firstChild.textContent+"), ";
								}
							}
						}
						
						if(chosenAttributesOrderByEmpty) {
							order = "";
							orderVisual = "";
						} else {
							var attributes = table.children[2].children;
							for(var p = 0; p < attributes.length; p++) {
								if(checkChosenAttributesOrderBy(j, p)) {
									order += pathAliases[i]+"."+attributes[p].firstChild.textContent+" "+chosenAttributesOrderBy[j][p]+", ";
									orderVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" <span class='queryControlWords'>"+chosenAttributesOrderBy[j][p]+"</span>, ";
								}
							}
						}
						
						if(histogramChosenValuesEmpty) {
							where = "";
							whereVisual = "";
						} else {
							var attributes = table.children[2].children;
							for(var p = 0; p < attributes.length; p++) {
								if(histogramChosenValues[j][p] != undefined) {
									var type = attributes[p].children[1].textContent;
									if(isSqlTypNumber(type)) {
										where += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = "+histogramChosenValues[j][p];
										whereVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = "+histogramChosenValues[j][p];
									} else {
										where += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = '"+histogramChosenValues[j][p]+"'";
										whereVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = '"+histogramChosenValues[j][p]+"'";
									}
								}
							}
						}
						
						var constraints = table.children[3].children;
						var keyFound = false;
						
						for(var k = 0; k < constraints.length; k++) {
							var referencedTable = constraints[k].children[3].textContent;
							
							if(referencedTable == path[i+1]) {
								
								keyFound = true;
								constraintCounter++;
								var columnName = constraints[k].children[0].textContent;
								var referencedColumnName = constraints[k].children[2].textContent;
								
								if(constraintCounter > 1) {
									joins += " AND ";
									joinsVisual += " <span class='queryControlWords'>AND</span> ";
								}
								
								joins += pathAliases[i]+"."+columnName+" = "+pathAliases[i+1]+"."+referencedColumnName;
								joinsVisual += pathAliases[i]+"."+columnName+" = "+pathAliases[i+1]+"."+referencedColumnName;
							}
						}
						
						if(!keyFound) {
							for(var l = 0; l < originalTables.length; l++) {
								
								if(originalTables[l].firstChild.textContent == path[i+1]) {
									
									if(flagAll) {
										attributesQuery = "*";
									} else {
										var attributes = table.children[2].children;
										for(var p = 0; p < attributes.length; p++) {
											if(chosenAttributes[l][p] && checkAggrFunctionChosen(l, p)) {
												attributesQuery += chosenAttributeAggrFunctions[l][p]+"("+pathAliases[i]+"."+attributes[p].firstChild.textContent+"), ";
											} else if(chosenAttributes[l][p]) {
												attributesQuery += pathAliases[i]+"."+attributes[p].firstChild.textContent+", ";
											} else if(checkAggrFunctionChosen(l, p)) {
												attributesQuery += chosenAttributeAggrFunctions[l][p]+"("+pathAliases[i]+"."+attributes[p].firstChild.textContent+"), ";
											}
										}
									}
									
									if(chosenAttributesOrderByEmpty) {
										order = "";
										orderVisual = "";
									} else {
										var attributes = table.children[2].children;
										for(var p = 0; p < attributes.length; p++) {
											if(checkChosenAttributesOrderBy(l, p)) {
												order += pathAliases[i]+"."+attributes[p].firstChild.textContent+" "+chosenAttributesOrderBy[l][p]+", ";
												orderVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" <span class='queryControlWords'>"+chosenAttributesOrderBy[l][p]+"</span>, ";
											}
										}
									}
									
									if(histogramChosenValuesEmpty) {
										where = "";
										whereVisual = "";
									} else {
										var attributes = table.children[2].children;
										for(var p = 0; p < attributes.length; p++) {
											if(histogramChosenValues[l][p] != undefined) {
												var type = attributes[p].children[1].textContent;
												if(isSqlTypNumber(type)) {
													where += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = "+histogramChosenValues[l][p];
													whereVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = "+histogramChosenValues[l][p];
												} else {
													where += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = '"+histogramChosenValues[l][p];+"'"
													whereVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = '"+histogramChosenValues[l][p]+"'";
												}
											}
										}
									}
									
									var constraints = originalTables[l].children[3].children;
									
									for(var m = 0; m < constraints.length; m++) {
										
										var referencedTable = constraints[m].children[3].textContent;
										
										if(referencedTable == pathTable) {

											constraintCounter++;
											var columnName = constraints[m].children[0].textContent;
											var referencedColumnName = constraints[m].children[2].textContent;
											
											if(constraintCounter > 1) {
												joins += " AND ";
												joinsVisual += " <span class='queryControlWords'>AND</span> ";
											}
											
											joins += pathAliases[i+1]+"."+columnName+" = "+pathAliases[i]+"."+referencedColumnName;
											joinsVisual += pathAliases[i+1]+"."+columnName+" = "+pathAliases[i]+"."+referencedColumnName;
										}
									}
								}
							}
						}
					}
				}
				
				if(i < (path.length-1)) {
					tablesQuery += " JOIN ";
					tablesQueryVisual += " <span class='queryControlWords'>JOIN</span> ";
					
				}
			}
			
			if(!flagAll) {
				attributesQuery = attributesQuery.substring(0, attributesQuery.length-2);
			}
			
			if(!chosenAttributesOrderByEmpty) {
				order = order.substring(0, order.length-2);
				orderVisual = orderVisual.substring(0, orderVisual.length-2);
			}
		}
		
		var limit = document.getElementById('limit').value;
		
		var query = "SELECT "+attributesQuery+" FROM "+tablesQuery+" "+joins+" "+where+" "+order+" LIMIT "+limit;
		var queryVisual = "<span class='queryControlWords'>SELECT</span> "+attributesQuery+" <span class='queryControlWords'>FROM</span> "+tablesQueryVisual+" "+joinsVisual+" "+whereVisual+" "+orderVisual+" <span class='queryControlWords'>LIMIT</span> "+limit;
		
		var queryDivContent = "<h2>Query</h2>"+queryVisual;
		document.getElementById("query").innerHTML = queryDivContent;
		
		var resultRows = "";			
		jQuery.ajax({
			type: "POST",
			url: 'requests.php',
			dataType: 'json',
			data: {functionname: 'processQueryRequest', argument: query},

			success: function (obj, textstatus) {
				if(!('error' in obj) ) {
					resultRows = obj.result;
								
					var resultHeader = "";			
					jQuery.ajax({
						type: "POST",
						url: 'requests.php',
						dataType: 'json',
						data: {functionname: 'processQueryHeaderRequest', argument: query},

						success: function (obj, textstatus) {
							if(!('error' in obj) ) {
								resultHeader = obj.result;

								var tableHeader = "";
								for(var i = 0; i < resultHeader.length; i++) {
									tableHeader += "<th style='cursor: pointer;'><span onclick='sortShowRows(&quot;"+resultHeader[i].orgtable+"&quot;, &quot;"+resultHeader[i].orgname+"&quot;);'>"+resultHeader[i].name+"</span>";
									
									var tIndex = 0;
									var aIndex = 0;
									for(var l = 0; l < originalTables.length; l++) {
										var tname = originalTables[l].firstChild.textContent;
										if(tname == resultHeader[i].orgtable) {
											var attributes = originalTables[l].children[2].children;
											for(var j = 0; j < attributes.length; j++) {
												var aname = attributes[j].firstChild.textContent;
												if(aname == resultHeader[i].orgname) {
													tIndex = l;
													aIndex = j;
												}
											}
										}
									}
									
									if(chosenAttributesOrderBy[tIndex][aIndex] == "None") {
										tableHeader += " <div id='sortIconRowsHeader'>&nbsp;</div>";
									} else if(chosenAttributesOrderBy[tIndex][aIndex] == "ASC") {
										tableHeader += " <div id='sortIconRowsHeader'>&#9650;</div>";
									} else if(chosenAttributesOrderBy[tIndex][aIndex] == "DESC") {
										tableHeader += " <div id='sortIconRowsHeader'>&#9660;</div>";
									}
									
									for(var j = 0; j < originalTables.length; j++) {
										var tablename = originalTables[j].firstChild.textContent;
										if(tablename == resultHeader[i].orgtable) {
											var attributes = originalTables[j].children[2].children;
											for(var l = 0; l < attributes.length; l++) {
												var attributeName = attributes[l].firstChild.textContent;
												if(attributeName == resultHeader[i].orgname) {
													tableHeader += " <div onclick='prepareHistogram("+j+", &quot;"+tablename+"&quot;, &quot;"+attributeName+"&quot;, "+l+", &quot;"+query+"&quot;);' class='histogramIcon'>&nbsp;</div>";
												}
											}
										}
									}
									
									tableHeader += "</div></th>";
								}
											
								var rows = "";
								for(var i = 0; i < resultRows.length; i++) {
									rows += "<tr>";
									for(var j = 0; j < resultRows[i].length; j++) {
										rows += "<td style='text-align: center;'>"+resultRows[i][j]+"</td>";
									}
									rows += "</tr>";
								}
											
								var content = "<p><table style='table-layout: fixed;'><tr>"+tableHeader+"</tr>"+rows+"</table></p>";
								document.getElementById("rowsTable").innerHTML = content;
							}
						}
					});
				}
			}
		});
	} else {
		document.getElementById("query").innerHTML = "<p>Click some tables while holding the Ctrl-Key to run a query.</p>";
		document.getElementById("rowsTable").innerHTML = "";
	}
}

/*
Sets the sorting arrays and calls showRows again.

Parameters:
tablename = table to sort from
attributename = attribute to sort with
*/
function sortShowRows(tablename, attributename) {
	var tIndex = 0;
	var aIndex = 0;
	
	for(var i = 0; i < originalTables.length; i++) {
		var tname = originalTables[i].firstChild.textContent;
		if(tname == tablename) {
			var attributes = originalTables[i].children[2].children;
			for(var j = 0; j < attributes.length; j++) {
				var aname = attributes[j].firstChild.textContent;
				if(aname == attributename) {
					tIndex = i;
					aIndex = j;
					
					if(chosenAttributesOrderBy[i][j] == "None") {
						chosenAttributesOrderBy[i][j] = "ASC";
					} else if(chosenAttributesOrderBy[i][j] == "ASC") {
						chosenAttributesOrderBy[i][j] = "DESC";
					} else if(chosenAttributesOrderBy[i][j] == "DESC") {
						chosenAttributesOrderBy[i][j] = "None";
					}
				}
			}
		}
	}
	
	showRows();
}

/*
Clears the given element from all content.

Parameters:
name = the name of the element, examples: "#divname"/".classname"
*/
function clearElement(name) {
	var el = d3.select(name);
	el.selectAll("*").remove();
}

/*
Specifies all the possible aggregate functions.
*/
function getAggregateFunctions() {
	return ["None", "AVG", "COUNT", "MAX", "MIN", "SUM"];
}

/*
Specifies all the possible order by functions.
*/
function getOrderByFunctions() {
	return ["None", "ASC", "DESC"];
}

/*
Prepares the data and window for the histogram.

Parameters:
tableId = the id of the table to draw the histogram
table = the table to draw the histogram
attribute = the attribute to draw the histogram
attributeId = the id of the attribute to draw the histogram
oldQuery = the old query if the histogram data should be taken from a query already set
*/
function prepareHistogram(tableId, table, attribute, attributeId, oldQuery) {
	var nrAttributes = parseFloat(attributeCardinalities[tableId][attributeId]);
	
	if(oldQuery == "") {
		if(nrAttributes <= 100 || confirm('You chose to see a histogram from "'+table+'" showing "'+attribute+'" with '+formatNumber(nrAttributes)+' different attribute values. This could take a while. Do you really want to continue?')) {
			var query = "SELECT "+attribute+", COUNT("+attribute+") FROM "+table+" GROUP BY "+attribute;
			
			var resultRows = "";			
			jQuery.ajax({
				type: "POST",
				url: 'requests.php',
				dataType: 'json',
				data: {functionname: 'processQueryRequest', argument: query},

				success: function (obj, textstatus) {
					if(!('error' in obj) ) {
						resultRows = obj.result;
										
						var widthNewWindow = window.innerWidth/2;
						var heightNewWindow = window.innerHeight/2;
							
						var newWindow = window.open("", "Histogram", "height="+heightNewWindow+",width="+widthNewWindow);
							
						newWindow.onunload = function() {
							for(var i = 0; i < tables.length; i++) {
								histogramChosenValues[i] = [];
										
								var attributes = tables[i].children[2].children;
								for(var k = 0; k < attributes.length; k++) {
									histogramChosenValues[i][k] = undefined;
								}
							}
								
							showRows();
						};
						
						newWindow.onresize = function(event) {
							width = event.target.outerWidth;
							height = event.target.outerHeight;
							
							newWindow.document.getElementsByTagName('body')[0].innerHTML = '';
							
							drawHistogram(width, height, newWindow, table, attribute, tableId, attributeId, resultRows);
						};
								
						drawHistogram(widthNewWindow, heightNewWindow, newWindow, table, attribute, tableId, attributeId, resultRows);
					}
				}
			});
		}
	} else {
		var query = "SELECT "+attribute+", COUNT("+attribute+") FROM ("+oldQuery+") m GROUP BY "+attribute;
			
		var resultRows = "";			
		jQuery.ajax({
			type: "POST",
			url: 'requests.php',
			dataType: 'json',
			data: {functionname: 'processQueryRequest', argument: query},

			success: function (obj, textstatus) {
				if(!('error' in obj) ) {
					resultRows = obj.result;
										
					var widthNewWindow = window.innerWidth/2;
					var heightNewWindow = window.innerHeight/2;
						
					var newWindow = window.open("", "Histogram", "height="+heightNewWindow+",width="+widthNewWindow);
						
					newWindow.onunload = function() {
						for(var i = 0; i < tables.length; i++) {
							histogramChosenValues[i] = [];
									
							var attributes = tables[i].children[2].children;
							for(var k = 0; k < attributes.length; k++) {
								histogramChosenValues[i][k] = undefined;
							}
						}
							
						showRows();
					};
					
					newWindow.onresize = function(event) {
						width = event.target.outerWidth;
						height = event.target.outerHeight;
						
						newWindow.document.getElementsByTagName('body')[0].innerHTML = '';
							
						drawHistogram(width, height, newWindow, table, attribute, tableId, attributeId, resultRows);
					};
							
					drawHistogram(widthNewWindow, heightNewWindow, newWindow, table, attribute, tableId, attributeId, resultRows);
				}
			}
		});
	}
}

/*
Draws the Histogram.

Parameters:
widthNewWindow = the width of the window to draw the histogram in
heightNewWindow = the height of the window to draw the histogram in
newWindow = the window to draw the histogram in
tableName = the table name of the histogram data
attributeName = the attribute name of the histogrm dama
tableId = the table id of the histogram data
attributeId = the attribute id of the histogram data
data = the data to draw
*/
function drawHistogram(widthNewWindow, heightNewWindow, newWindow, tableName, attributeName, tableId, attributeId, data) {
	var newWindowRoot = d3.select(newWindow.document.body)
		.style("font-family", "Arial, Helvetica, sans-serif")
		.style("background-color", "#fcfcfc")
		.style("font-size", "15px");
						
	newWindowRoot.append("div").append("p")
		.html("Table: "+tableName+", Attribute: "+attributeName);
						
	var newWindowChart = newWindowRoot.append("div");
	
	var nrBars = data.length;
	var widthCalculated = 20*nrBars + 10*nrBars;
	
	var actualWidth = widthCalculated;
	if(widthCalculated < widthNewWindow/2) {
		actualWidth = widthNewWindow/2;
	}
	
	var minHeight = 500;
	var actualHeight = heightNewWindow;
	if(heightNewWindow < minHeight) {
		actualHeight = minHeight;
	}
	
	var margin = {top: 20, right: 20, bottom: 150, left: 100},
		width = actualWidth - margin.left - margin.right,
		height = actualHeight - margin.top - margin.bottom;

	var x = d3.scale.ordinal().rangeRoundBands([0, width]);
	var y = d3.scale.linear().range([height - margin.bottom, 0]);

	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom");
		
	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left");

	var svg = newWindowChart.append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
			.attr("transform", 
				"translate(" + margin.left + "," + margin.top + ")");
		
	x.domain(data.map(function(d) { return d[0]; }));
	y.domain([0, d3.max(data, function(d) { return parseFloat(d[1]); })]);

	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + (height - margin.bottom) + ")")
		.call(xAxis)
		.selectAll(".tick")
			.attr("transform", function(d, i) { return "translate(" + (width/nrBars*i+2) + ",0)"; })
		.selectAll("text")
			.style("text-anchor", "end")
			.attr("dx", "-.8em")
			.attr("dy", ".5em")
			.style("font-size", "12px")
			.attr("transform", "rotate(-90)" );

	svg.append("g")
		.attr("class", "y axis")
		.call(yAxis)
		.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 5)
			.attr("dy", "-80")
			.style("text-anchor", "end")
			.style("font-size", "12px")  
			.text("Occurences Of");

	svg.selectAll("bar")
		.data(data)
		.enter().append("rect")
			.style("fill", "steelblue")
			.attr("x", function(d, i) { return width/nrBars*i+2; })
			.attr("width", 20)
			.attr("y", function(d) { return y(parseFloat(d[1])); })
			.attr("height", function(d) { return height - margin.bottom - y(d[1]); })
			.on("click", function(d) {
				svg.selectAll("rect").style("fill", "steelblue");
				
				if(histogramChosenValues[tableId][attributeId] == d[0]) {
					histogramChosenValues[tableId][attributeId] = undefined;
					
					d3.select(this).style("fill", "steelblue");
				} else {
					histogramChosenValues[tableId][attributeId] = d[0];
					
					d3.select(this).style("fill", "deepskyblue");
					
					for(var i = 0; i < tables.length; i++) {
						var attributes = tables[i].children[2].children;
						for(var j = 0; j < attributes.length; j++) {
							if(i != tableId && j != attributeId) {
								histogramChosenValues[i][j] = undefined
							}
						}
					}
				}
				
				showRows();
			});
		
	svg.selectAll("rect").append("title")
		.style("font-size", "12px")  
		.text(function(d) {
			var percent = d[1] / d3.sum(data, function(d) { return parseFloat(d[1]); }) * 100;
			return d[0]+": "+formatNumber(parseFloat(d[1]))+" ("+formatNumber(percent) +"%)";
		});
}

/*
Format a number (can be a string containing a number as the function parses every input to float) the german style.
Example: number 120000.05 is parsed to 120.000,05

Parameters:
number = the number to format

Returns the parsed number.
*/
function formatNumber(number) {
	var numberParsed = parseFloat(number);
	
	return numberParsed.toLocaleString('de-DE');
}

/*
Check if number string is a mySQL number type.

Parameters:
type = the string to determine if is a number type

Returns true if it represents a number type, else false.
*/
function isSqlTypNumber(type) {
	var list = [];
	list.push("int");
	list.push("dec");
	list.push("numeric");
	list.push("fixed");
	list.push("float");
	list.push("double");
	list.push("bit");
	list.push("real");
	
	for(var i = 0; i < list.length; i++) {
		if(type.indexOf(list[i]) > -1) {
			return true;
		}
	}
	
	return false;
}