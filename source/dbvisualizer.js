/*
Author: Fiona Waser
*/

var lowCardinalityThreshold = 50;

var tables;
var graph;
var matrix = [];
var references = [];
var map = {};
var attributeCardinalities = [];
var attributeCardinalitiesPercentages = [];
var constraintCardinalities = [];
var constraintCardinalitiesPercentages = [];
var chosenTables = [];
var chosenChord = null;
var chosenAttributes = [];
var chosenAttributeAggrFunctions = [];
var chosenAttributesOrderBy = [];
var histogramChosenValues = [];

function prepareStructuralView() {
	$("#helpParent").mouseover(function() {
		$(this).children("#helpPopup").show();
	}).mouseout(function() {
		$(this).children("#helpPopup").hide();
	});
	
	drawStructuralChordDiagramInit();
}

function drawStructuralChordDiagramInit() {
	d3.xml("tables.xml", "application/xml", function(xml) {
		
		tables = xml.getElementsByTagName("table");
		
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
		
		for(var i = 0; i < tables.length; i++) {
			matrix[i] = [];
				
			references[i] = [];
				
			var tablename = tables[i].children[0].textContent;
			map[tablename] = {};
				
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
				}
			}
		}
		graph = new Graph(map);
		
		drawStructuralChordDiagram();
		
	});
}

function confirmRefreshRowRelatedInfo() {
	if(confirm('This may take several minutes. Are you sure you want to perform this action now?')) {
		document.getElementById("refreshConfirmation").value = "yes";
	}
}

function drawStructuralChordDiagram() {
	clearElement("#diagram");
	
	var diagramWidth = $(window).width()/2-20;
	
	var width = diagramWidth,
		height = 800,
		outerRadius = Math.min(width, height) / 2 - 50,
		innerRadius = outerRadius - 62;
		
	d3.select("body").on("keydown", function() {});
	
	var svg = d3.select("#diagram").append("svg")
		.attr("width", width)
		.attr("height", height)
		.append("g")
		.attr("id", "circle")
		.style("font", "12px sans-serif")
		.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
		
	var density_color_picker = d3.scale.linear()
		.domain([0, tables.length-1])
		.range(["white", "black"]);
		
	var values_nr_rows_domain = [];
	for(var n = 0; n < tables.length; n++) {
		var current_value = parseFloat(tables[n].children[1].textContent);
		
		if(values_nr_rows_domain == null) {
			values_nr_rows_domain.push(current_value);
		} else {
			var index = 0;
			while(current_value > values_nr_rows_domain[index]) {
				index++;
			}
			values_nr_rows_domain.splice(index, 0, current_value);
		}
	}
	var values_nr_rows_range = [];
	for(var n = 0; n < values_nr_rows_domain.length; n++) {
		values_nr_rows_range[n] = density_color_picker(n);
	}
	
	var density_colors = d3.scale.linear()
		.domain(values_nr_rows_domain)
		.range(values_nr_rows_range);
	
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

	svg.append("circle")
		.style("fill", "none")
		.style("pointer-events", "all")
		.attr("r", outerRadius-40);

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

	group.append("title").text(function(d, i) {
		var number = parseFloat(tables[i].children[1].textContent);
		return tables[i].children[0].textContent+" ("+formatNumber(number)+" rows)";
	});

	var groupPath = group.append("path")
		.attr("id", function(d, i) { return "group" + i; })
		.attr("d", arc)
		.style("fill", function(d, i) { return density_colors(parseFloat(tables[i].children[1].textContent)); })
		.style("fill-opacity", ".5")
		.style("stroke", "black")
		.style("stroke-width", ".25px")
		.on("click", function(d) {
			showAttributeInfo(d.index);
			
			if(d3.event.ctrlKey) {
				if(chosenChord != null) {
					chosenChord = null;
					chosenTables = [];
				}
				
				setTableChosen(d.index);
				
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
				if(chosenChord != null) {
					chosenChord = null;
					chosenTables = [];
				}
				
				setTableChosen(d.index);
				
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

	var chord = svg.selectAll(".chord")
		.data(layout.chords)
		.enter().append("path")
		.attr("class", "chord")
		.style("fill", function(d) {
			return cardinality_colors(getCardinalityCumulatedPercentage(d));
		})
		.style("opacity", function(d) {
			if(d.source.index == d.target.index) {
				return "0";
			} else {
				return "1";
			}
		})
		.attr("d", path)
		.style("stroke", "#000")
		.style("stroke-width", ".25px")
		.on("click", function(d) {
			if(d.source.index != d.target.index) {
				chosenChord = d;
				
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
			if(d.source.index != d.target.index) {
				d3.select(this).style("cursor", "pointer");
				
				$(".group:eq("+d.source.index+") text").css("font-weight", "bold");
				$(".group:eq("+d.target.index+") text").css("font-weight", "bold");
				$(".group:eq("+d.source.index+") text").css("font-size", "15px");
				$(".group:eq("+d.target.index+") text").css("font-size", "15px");
			}
		}).on("mouseout", function(d) {
			if(d.source.index != d.target.index) {
				d3.select(this).style("cursor", "default");
				
				$(".group:eq("+d.source.index+") text").css("font-weight", "normal");
				$(".group:eq("+d.target.index+") text").css("font-weight", "normal");
				$(".group:eq("+d.source.index+") text").css("font-size", "12px");
				$(".group:eq("+d.target.index+") text").css("font-size", "12px");
			}
		});

	chord.append("title").text(function(d) {
		if(d.source.index != d.target.index) {
			return references[d.source.index][d.target.index];
		}
	});
		
	var legends = d3.select("#legends").append("svg")
		.attr("width", diagramWidth);
	
	var gradientWidth = 250;
	var gradientWidthLeft = gradientWidth/2;
	var gradientWidthNrRows = 250;
	var gradientHeight = 20;
	var gradientYMin = 30;
	var gradientXLeft = diagramWidth/4-gradientWidth/2;
	var gradientXRight = diagramWidth/4;
	var gradientXNrRows = diagramWidth/4*3-gradientWidth/2;

	var defsLeft = legends.append("defs");
	
	var linearGradientLeft = defsLeft.append("linearGradient")
		.attr("id", "linearGradientLeft");
		
	linearGradientLeft
		.attr("x1", 0)
		.attr("y1", 0)
		.attr("x2", gradientWidthLeft)
		.attr("y2", 0);
		
	linearGradientLeft.append("stop") 
		.attr("x", 0)
		.attr("y", gradientWidthLeft)
		.attr("stop-color", cardinality_colors(0));

	linearGradientLeft.append("stop") 
		.attr("x", gradientWidthLeft)
		.attr("y", 0)
		.attr("stop-color", cardinality_colors(1));
		
	var legendTitle = ["LegendTitle"];
		
	var legendBar = legends.selectAll("g")
		.data(legendTitle)
		.enter().append("g");
		
	legendBar.append("text")
		.attr("x", gradientXLeft+gradientWidthLeft)
		.attr("y", gradientYMin-5)
		.attr("width", gradientWidth)
		.attr("height", 10)
		.attr("text-anchor", "middle")
		.text(function(d) { return "Contraint Cardinality"; });
		
	legendBar.append("text")
		.attr("x", gradientXNrRows+gradientWidth/2)
		.attr("y", gradientYMin-5)
		.attr("width", gradientWidth)
		.attr("height", 10)
		.attr("text-anchor", "middle")
		.text(function(d) { return "Nr. Rows"; });
			
	legendBar.append("rect")
		.attr("x", gradientXLeft)
		.attr("y", gradientYMin)  
		.attr("width", gradientWidthLeft)
		.attr("height", gradientHeight)
		.style("fill", "url(#linearGradientLeft)");
		
	legendBar.append("text")
		.attr("x", gradientXLeft)
		.attr("y", gradientYMin+gradientHeight+15)
		.attr("width", gradientWidthLeft)
		.attr("height", 10)
		.attr("text-anchor", "middle")
		.text(function(d) { return "0%"; });
		
	legendBar.append("text")
		.attr("x", gradientXLeft+gradientWidthLeft)
		.attr("y", gradientYMin+gradientHeight+15)
		.attr("width", gradientWidthLeft)
		.attr("height", 10)
		.attr("text-anchor", "middle")
		.text(function(d) { return "100%"; });
		
	var defsRight = legends.append("defs");
		
	var linearGradientRight = defsRight.append("linearGradient")
		.attr("id", "linearGradientRight");
		
	linearGradientRight
		.attr("x1", 0)
		.attr("y1", 0)
		.attr("x2", gradientWidthLeft)
		.attr("y2", 0);
		
	linearGradientRight.append("stop") 
		.attr("x", gradientWidthLeft)
		.attr("y", 0)
		.attr("stop-color", cardinality_colors(1));

	linearGradientRight.append("stop") 
		.attr("x", gradientWidthLeft)
		.attr("y", 0)  
		.attr("stop-color", cardinality_colors(2));
		
	legendBar.append("rect")
		.attr("x", gradientXRight)
		.attr("y", gradientYMin)
		.attr("width", gradientWidthLeft)
		.attr("height", gradientHeight)
		.style("fill", "url(#linearGradientRight)");
		
	legendBar.append("text")
		.attr("x", gradientXRight+gradientWidthLeft)
		.attr("y", gradientYMin+gradientHeight+15)
		.attr("width", gradientWidth)
		.attr("height", 10)
		.attr("text-anchor", "middle")
		.text(function(d) { return "200%"; });
		
	var defsNrRows = legends.append("defs");
	
	var linearGradientNrRows = defsLeft.append("linearGradient")
		.attr("id", "linearGradientNrRows");
		
	linearGradientNrRows
		.attr("x1", 0)
		.attr("y1", 0)
		.attr("x2", gradientWidth)
		.attr("y2", 0);
		
	linearGradientNrRows.append("stop") 
		.attr("x", 0)
		.attr("y", gradientWidth)
		.attr("stop-color", density_colors(0));

	linearGradientNrRows.append("stop") 
		.attr("x", 0)
		.attr("y", gradientWidth)
		.attr("stop-color", density_colors(density_colors.range().length-1));
		
	legendBar.append("rect")
		.attr("x", gradientXNrRows)
		.attr("y", gradientYMin)
		.attr("width", gradientWidth)
		.attr("height", gradientHeight)
		.style("fill", "url(#linearGradientNrRows)");
		
	legendBar.append("text")
		.attr("x", gradientXNrRows)
		.attr("y",gradientYMin+gradientHeight+15)
		.attr("width", gradientWidth)
		.attr("height", 10)
		.attr("text-anchor", "middle")
		.text(function(d) { return formatNumber(values_nr_rows_domain[0]); });
		
	legendBar.append("text")
		.attr("x", gradientXNrRows+gradientWidth)
		.attr("y",gradientYMin+gradientHeight+15)
		.attr("width", gradientWidth)
		.attr("height", 10)
		.attr("text-anchor", "middle")
		.text(function(d) { return formatNumber(values_nr_rows_domain[values_nr_rows_domain.length-1]); });
}

function getDensityRange(values) {
	var min = 0;
	var max = 0;
	
	for(var n = 0; n < values.length; n++) {
		var currentValue = values[n];
		
		if(min == 0 || max == 0) {
			min = currentValue;
			max = currentValue;
		} else {
			if(currentValue < min) {
				min = currentValue;
			}
			
			if(currentValue > max) {
				max = currentValue;
			}
		}
	}
	
	return {
		min: min,
		max: max
	};
}

function getCardinalityCumulatedPercentage(d) {
	var values = constraintCardinalitiesPercentages[d.source.index][d.target.index].split(" ");
	var valuesSum = 0;
	for(var i = 0; i < (values.length-1); i++) {
		valuesSum += parseFloat(values[i]);
	}
	var cumulatedPercentage = valuesSum / (values.length-1);
	
	return cumulatedPercentage;
}

function checkTableChosen(tableIndex) {
	if($.inArray(tableIndex, chosenTables) == -1) {
		return false;
	} else {
		return true;
	}
}

function setTableChosen(tableIndex) {
	if(checkTableChosen(tableIndex)) {
		var index = chosenTables.indexOf(tableIndex);
		chosenTables.splice(index, 1);
	} else {
		chosenTables.push(tableIndex);
	}
}

function checkAttributeChosen(tableIndex, attributeIndex) {
	return chosenAttributes[tableIndex][attributeIndex];
}

function setAttributeChosen(tableIndex, attributeIndex) {
	if(checkAttributeChosen(tableIndex, attributeIndex)) {
		chosenAttributes[tableIndex][attributeIndex] = false;
	} else {
		chosenAttributes[tableIndex][attributeIndex] = true;
	}
}

function setAggrFunctionChosen(tableIndex, attributeIndex, func) {
	chosenAttributeAggrFunctions[tableIndex][attributeIndex] = func;
}

function checkAggrFunctionChosen(tableIndex, attributeIndex) {
	if(chosenAttributeAggrFunctions[tableIndex][attributeIndex] == "None") {
		return false;
	} else {
		return true;
	}
}

function checkChosenAttributesOrderBy(tableIndex, attributeIndex) {
	if(chosenAttributesOrderBy[tableIndex][attributeIndex] == "None") {
		return false;
	} else {
		return true;
	}
}

function setChosenAttributesOrderBy(tableIndex, attributeIndex, order) {
	chosenAttributesOrderBy[tableIndex][attributeIndex] = order;
}

function checkHistogramChosenValue(tableIndex, attributeIndex) {
	if(histogramChosenValues[tableIndex][attributeIndex] == undefined) {
		return false;
	} else {
		return true;
	}
}

function setHistogramChosenValue(tableIndex, attributeIndex, value) {
	histogramChosenValues[tableIndex][attributeIndex] = value;
}

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
		if(attrCardinality <= lowCardinalityThreshold) {
			if(attrCardinality >= 1) {
				cardinalityInfo = "high ("+formatNumber(attrCardinality)+" - "+formatNumber(percent)+"%)";
			} else {
				cardinalityInfo = "low ("+formatNumber(attrCardinality)+" - "+formatNumber(percent)+"%)";
			}
		} else if(attrCardinality >= 1) {
			cardinalityInfo = "high ("+formatNumber(attrCardinality)+" - "+formatNumber(percent)+"%)";
		} else {
			cardinalityInfo = "high ("+formatNumber(attrCardinality)+" - "+formatNumber(percent)+"%)";
		}
		
		var fullRectWidth = 150;
		var rowHeight = 20;
		var barWidth = fullRectWidth * attributeCardinalitiesPercentages[index][j];
		var svg = "<svg width='"+fullRectWidth+"' height='"+rowHeight+"'><rect width='"+barWidth+"' height='"+rowHeight+"' style='fill: steelblue;' /></svg>";
		
		var choserContent = "<td>";
		if(checkAttributeChosen(index, j)) {
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
		
		var histogramChooser = "";
		if(key != "PRI") {
			histogramChooser = "<div onclick='prepareHistogram("+index+", &quot;"+tablename+"&quot;, &quot;"+field+"&quot;, "+j+", false, 0);' class='histogramIcon'>&nbsp;</div>";
		}
		
		content += "<tr>"+choserContent+"<td>"+field+"</td><td>"+type+"</td><td>"+null_+"</td><td>"+key+"</td><td>"+default_+"</td><td>"+extra+"</td><td>"+unit+"</td><td>"+svg+"</br> "+cardinalityInfo+"</td><td>"+histogramChooser+"</td><td>"+aggFunctionsHtml+"</td><td>"+choserContentOrder+"</td></tr>";
	}
	
	content += "</table></p>";

	document.getElementById("attributeInfo").innerHTML = content;
}

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

function showRows() {
	if(chosenChord != null) {
		chosenTables = [chosenChord.target.index, chosenChord.source.index];
	}
	
	if(chosenTables.length > 0) {
		var chosenAttributesAll = true;
		for(var i = 0; i < chosenAttributes.length; i++) {
			for(var j = 0; j < chosenAttributes[i].length; j++) {
				if(!checkAttributeChosen(i, j)) {
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
				if(checkHistogramChosenValue(i, j)) {
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
					if(checkAttributeChosen(index, p) && checkAggrFunctionChosen(index, p)) {
						attributesQuery += chosenAttributeAggrFunctions[index][p]+"("+attributes[p].firstChild.textContent+"), ";
					} else if(checkAttributeChosen(index, p)) {
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
					if(checkHistogramChosenValue(index, p)) {
						var type = attributes[p].children[1].textContent;
						if(isSqlTypNumber(type)) {
							where += attributes[p].firstChild.textContent+" = "+histogramChosenValues[index][p]+" AND ";
							whereVisual += attributes[p].firstChild.textContent+" = "+histogramChosenValues[index][p]+" AND ";
						} else {
							where += attributes[p].firstChild.textContent+" = '"+histogramChosenValues[index][p]+"' AND ";
							whereVisual += attributes[p].firstChild.textContent+" = '"+histogramChosenValues[index][p]+"' AND ";
						}
					}
				}
				where = where.substring(0, where.length-5);
				whereVisual = whereVisual.substring(0, whereVisual.length-5);
			}
		} else if(chosenTables.length > 1) {
			for(var i = 0; i < chosenTables.length; i++) {
				if(i < chosenTables.length-1) {
					var sourceTable = tables[chosenTables[i]];
					var sourceTablename = sourceTable.firstChild.textContent;
					var targetTable = tables[chosenTables[i+1]];
					var targetTablename = targetTable.firstChild.textContent;
					
					// https://github.com/andrewhayward/dijkstra
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
				
				for(var j = 0; j < tables.length; j++) {
					var table = tables[j];
					var tableName = table.firstChild.textContent;
					
					if(pathTable == tableName) {
						
						if(flagAll) {
							attributesQuery = "*";
						} else {
							var attributes = table.children[2].children;
							for(var p = 0; p < attributes.length; p++) {
								if(checkAttributeChosen(j, p) && checkAggrFunctionChosen(j, p)) {
									attributesQuery += chosenAttributeAggrFunctions[j][p]+"("+pathAliases[i]+"."+attributes[p].firstChild.textContent+"), ";
								} else if(checkAttributeChosen(j, p)) {
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
								if(checkHistogramChosenValue(j, p)) {
									var type = attributes[p].children[1].textContent;
									if(isSqlTypNumber(type)) {
										where += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = "+histogramChosenValues[j][p]+" AND ";
										whereVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = "+histogramChosenValues[j][p]+" AND ";
									} else {
										where += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = '"+histogramChosenValues[j][p]+"' AND ";
										whereVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = '"+histogramChosenValues[j][p]+"' AND ";
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
							for(var l = 0; l < tables.length; l++) {
								
								if(tables[l].firstChild.textContent == path[i+1]) {
									
									if(flagAll) {
										attributesQuery = "*";
									} else {
										var attributes = table.children[2].children;
										for(var p = 0; p < attributes.length; p++) {
											if(checkAttributeChosen(l, p) && checkAggrFunctionChosen(l, p)) {
												attributesQuery += chosenAttributeAggrFunctions[l][p]+"("+pathAliases[i]+"."+attributes[p].firstChild.textContent+"), ";
											} else if(checkAttributeChosen(l, p)) {
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
											if(checkHistogramChosenValue(l, p)) {
												var type = attributes[p].children[1].textContent;
												if(isSqlTypNumber(type)) {
													where += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = "+histogramChosenValues[l][p]+" AND ";
													whereVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = "+histogramChosenValues[l][p]+" AND ";
												} else {
													where += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = '"+histogramChosenValues[l][p]+"' AND ";
													whereVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" = '"+histogramChosenValues[l][p]+"' AND ";
												}
											}
										}
									}
									
									var constraints = tables[l].children[3].children;
									
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
			
			if(!histogramChosenValuesEmpty) {
				where = where.substring(0, where.length-5);
				whereVisual = whereVisual.substring(0, whereVisual.length-5);
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
									tableHeader += "<th style='cursor: pointer;'><div id='tableHeaderCellContent' style='height: 24px;'><div id='tableHeaderCellText' style='float: left; height: 24px;'><span onclick='sortShowRows(&quot;"+resultHeader[i].orgtable+"&quot;, &quot;"+resultHeader[i].orgname+"&quot;);'>"+resultHeader[i].name+"</span></div>";
									
									var tIndex = 0;
									var aIndex = 0;
									for(var l = 0; l < tables.length; l++) {
										var tname = tables[l].firstChild.textContent;
										if(tname == resultHeader[i].orgtable) {
											var attributes = tables[l].children[2].children;
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
										tableHeader += " <div id='sortIconRowsHeader' style='float: left; width: 14px; height: 24px;'>&nbsp;</div>";
									} else if(chosenAttributesOrderBy[tIndex][aIndex] == "ASC") {
										tableHeader += " <div id='sortIconRowsHeader' style='float: left; width: 14px; height: 24px;'>&#9650;</div>";
									} else if(chosenAttributesOrderBy[tIndex][aIndex] == "DESC") {
										tableHeader += " <div id='sortIconRowsHeader' style='float: left; width: 14px; height: 24px;'>&#9660;</div>";
									}
									
									for(var j = 0; j < tables.length; j++) {
										var tablename = tables[j].firstChild.textContent;
										if(tablename == resultHeader[i].orgtable) {
											var attributes = tables[j].children[2].children;
											for(var l = 0; l < attributes.length; l++) {
												var attributeName = attributes[l].firstChild.textContent;
												if(attributeName == resultHeader[i].orgname) {
													var key = attributes[l].children[3].textContent;
													if(key != "PRI") {
														tableHeader += " <div onclick='prepareHistogram("+j+", &quot;"+tablename+"&quot;, &quot;"+attributeName+"&quot;, "+l+", true, "+limit+");' class='histogramIcon'>&nbsp;</div>";
													}
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
										rows += "<td>"+resultRows[i][j]+"</td>";
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

function sortShowRows(tablename, attributename) {
	var tIndex = 0;
	var aIndex = 0;
	
	for(var i = 0; i < tables.length; i++) {
		var tname = tables[i].firstChild.textContent;
		if(tname == tablename) {
			var attributes = tables[i].children[2].children;
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

function clearElement(name) {
	var el = d3.select(name);
	el.selectAll("*").remove();
}

function getAggregateFunctions() {
	return ["None", "AVG", "COUNT", "MAX", "MIN", "SUM"];
}

function getOrderByFunctions() {
	return ["None", "ASC", "DESC"];
}

function prepareHistogram(tableId, table, attribute, attributeId, limitSet, limit) {
	var nrAttributes = parseFloat(attributeCardinalities[tableId][attributeId]);
	
	if(limitSet || nrAttributes <= 100 || confirm('You chose to see a histogram from "'+table+'" showing "'+attribute+'" with '+formatNumber(nrAttributes)+' different attribute values. Do you really want to continue?')) {
		if(limitSet) {
			var query = "SELECT "+attribute+", COUNT("+attribute+") FROM (SELECT * FROM "+table+" LIMIT 10) t GROUP BY "+attribute;
			
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
						
						var newWindowRoot = d3.select(newWindow.document.body)
							.style("font-family", "Arial, Helvetica, sans-serif")
							.style("background-color", "#fcfcfc")
							.style("font-size", "15px");
						
						newWindowRoot.append("div").append("p")
							.html("Table: "+table+", Attribute: "+attribute);
						
						var newWindowChart = newWindowRoot.append("div");
							
						drawHistogram(newWindow, newWindowChart, tableId, attributeId, resultRows);
					}
				}
			});
		} else {
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
						
						var newWindowRoot = d3.select(newWindow.document.body)
							.style("font-family", "Arial, Helvetica, sans-serif")
							.style("background-color", "#fcfcfc")
							.style("font-size", "15px");
						
						newWindowRoot.append("div").append("p")
							.html("Table: "+table+", Attribute: "+attribute);
						
						var newWindowChart = newWindowRoot.append("div");
							
						drawHistogram(newWindow, newWindowChart, tableId, attributeId, resultRows);
					}
				}
			});
		}
	}
}

function drawHistogram(newWindow, newWindowRoot, tableId, attributeId, data) {
	var windowWidth = newWindow.innerWidth;
	var windowHeight = newWindow.innerHeight;
	
	var nr_bars = data.length;
	var width_calculated = 20 * nr_bars;
	
	var margin = {top: 50, right: 150, bottom: 150, left: 150},
		width = 300 + width_calculated - margin.left - margin.right,
		height = 650 - margin.top - margin.bottom;

	var x = d3.scale.ordinal().rangeRoundBands([0, width], .05);
	var y = d3.scale.linear().range([height, 0]);

	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom");
		
	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left");

	var svg = newWindowRoot.append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
			.attr("transform", 
				"translate(" + margin.left + "," + margin.top + ")");
		
	x.domain(data.map(function(d) { return d[0]; }));
	y.domain([0, d3.max(data, function(d) { return parseFloat(d[1]); })]);

	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis)
		.selectAll("text")
			.style("text-anchor", "end")
			.attr("dx", "-.8em")
			.attr("dy", "-.3em")
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
			.attr("x", function(d) { return x(d[0]); })
			.attr("width", x.rangeBand())
			.attr("y", function(d) { return y(d[1]); })
			.attr("height", function(d) { return height - y(d[1]); })
			.on("click", function(d) {
				svg.selectAll("rect").style("fill", "steelblue");
				
				for(var i = 0; i < tables.length; i++) {
					histogramChosenValues[i] = [];
						
					var attributes = tables[i].children[2].children;
					for(var k = 0; k < attributes.length; k++) {
						histogramChosenValues[i][k] = undefined;
					}
				}
				
				if(checkHistogramChosenValue(tableId, attributeId)) {
					setHistogramChosenValue(tableId, attributeId, undefined);
				} else {
					d3.select(this).style("fill", "deepskyblue");
					setHistogramChosenValue(tableId, attributeId, d[0]);
				}
				
				showRows();
			});
		
	svg.selectAll("rect").append("title")
		.style("font-size", "12px")  
		.text(function(d) {
			var percent = d[1] / d3.sum(data, function(d) { return d[1]; }) * 100;
			return d[0]+": "+d[1]+" ("+formatNumber(percent) +"%)";
		});
}

function formatNumber(number) {
	return number.toLocaleString('de-DE');
}

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

jQuery.fn.d3Click = function () {
  this.each(function (i, e) {
    var evt = new MouseEvent("click");
    e.dispatchEvent(evt);
  });
};