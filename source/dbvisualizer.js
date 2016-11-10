/*
Author: Fiona Waser
*/

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
var chosenAttributes = [];
var chosenAttributeAggrFunctions = [];
var chosenAttributesOrderBy = [];

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
				
			var attributes = tables[i].children[2].children;
			for(var k = 0; k < attributes.length; k++) {
				attributeCardinalities[i][k] = "";
				attributeCardinalitiesPercentages[i][k] = "";
				chosenAttributes[i][k] = true;
				chosenAttributeAggrFunctions[i][k] = "None";
				chosenAttributesOrderBy[i][k] = "None";
			}
				
			constraintCardinalities[i] = [];
			constraintCardinalitiesPercentages[i] = [];
				
			for(var j = 0; j < tables.length; j++) {
				matrix[i][j] = 0;
					
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
	
	var width = 800,
		height = 800,
		outerRadius = Math.min(width, height) / 2 - 50,
		innerRadius = outerRadius - 62;
		
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
		.domain([0, 1])
		.range(["white", "steelblue"]);
			
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
		.on('click', function(d) {
			$(".group:eq("+d.index+") text").d3Click();
		})
		.on("mouseover", function(d) {
			d3.select(this).style("cursor", "pointer");
			
			$(".group:eq("+d.index+") text").css("font-weight", "bold");
			
			showAttributeInfo(d.index);
		})
		.on("mouseout", function(d) {
			d3.select(this).style("cursor", "default");
			
			$(".group:eq("+d.index+") text").css("font-weight", "normal");
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
		.on('click', function(d) {
			showAttributeInfo(d.index);
			setTableChosen(d.index);
			
			$(".group path").css("stroke-width", ".25px");
			for(var i = 0; i < chosenTables.length; i++) {
				$(".group:eq("+chosenTables[i]+") path").css("stroke-width", "2.5px");
			}
			
			showRows();
		})
		.on("mouseover", function(d) {
			d3.select(this).style("cursor", "pointer");
			
			d3.select(this).style("font-weight", "bold");
			
			showAttributeInfo(d.index);
		})
		.on("mouseout", function(d) {
			d3.select(this).style("cursor", "default");
			d3.select(this).style("font-weight", "normal");
		});

	var chord = svg.selectAll(".chord")
		.data(layout.chords)
		.enter().append("path")
		.attr("class", "chord")
		.style("fill", function(d) {
			return cardinality_colors(getCardinalityCumulatedPercentage(d));
		})
		.attr("d", path)
		.style("stroke", "#000")
		.style("stroke-width", ".25px")
		.on('click', function(d) {
			if(chosenTables.length != 0) {
				chosenTables = [];
			}
			
			$(".group:eq("+d.source.index+") text").d3Click();
			$(".group:eq("+d.target.index+") text").d3Click();
		})
		.on("mouseover", function(d) {
			d3.select(this).style("cursor", "pointer");
			
			$(".group:eq("+d.source.index+") text").css("font-weight", "bold");
			$(".group:eq("+d.target.index+") text").css("font-weight", "bold");
		}).on("mouseout", function(d) {
			d3.select(this).style("cursor", "default");
			
			$(".group:eq("+d.source.index+") text").css("font-weight", "normal");
			$(".group:eq("+d.target.index+") text").css("font-weight", "normal");
		});

	chord.append("title").text(function(d) {
		if(references[d.source.index][d.target.index] == "") {
			return "no reference";
		} else {
			return references[d.source.index][d.target.index];
		}
	});
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

function showAttributeInfo(index) {
	clearElement("#attributeInfo");
	
	var fullRectWidth = 200;
				
	var table = tables[index];
	var tablename = table.firstChild.textContent;
	
	var attributes = table.children[2].children;
	
	var content = "<p><h2>Attributes: "+tablename+"</h2>";
	content += "<table id='attributesTable'>";
	content += "<tr><th></th><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th><th>Extra</th><th>Unit</th><th>Cardinality</th><th>AggFunction</th><th>OrderBy</th></tr>";
	
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
		var cardinalityLow = false;
		var percent = attributeCardinalitiesPercentages[index][j]*100;
		if(attributeCardinalities[index][j] <= 50) {
			cardinalityInfo = "low ("+attributeCardinalities[index][j]+" - "+formatNumber(percent)+"%)";
			if(key != "PRI") {
				cardinalityLow = true;
			}
		} else if(attributeCardinalitiesPercentages[index][j] == 1) {
			cardinalityInfo = "high ("+attributeCardinalities[index][j]+" - "+formatNumber(percent)+"%)";
		} else {
			cardinalityInfo = "high ("+attributeCardinalities[index][j]+" - "+formatNumber(percent)+"%)";
		}
		
		var rowHeight = 20;
		var barWidth = fullRectWidth * attributeCardinalitiesPercentages[index][j];
		var svg = "<svg width='"+fullRectWidth+"' height='"+rowHeight+"'><rect width='"+barWidth+"' height='"+rowHeight+"' style='fill: steelblue;' /></svg>";
		
		var choserContent = "<td onclick='setAttributeChosen("+index+", "+j+");'>";
		if(checkAttributeChosen(index, j)) {
			choserContent += "<input type='checkbox' name='"+field+"' value='"+field+"' onchange='showRows();' checked='checked'>";
		} else {
			choserContent += "<input type='checkbox' name='"+field+"' value='"+field+"' onchange='showRows();'>";
		}
		choserContent += "</td>";
		
		var aggFunctionsHtml = "<select name='chooseAggFunctions' onchange='setAggrFunctionChosen("+index+", "+j+", this.value); showRows();'>";
		for(var i = 0; i < aggregateFunctions.length; i++) {
			aggFunctionsHtml += "<option value='"+aggregateFunctions[i]+"'>"+aggregateFunctions[i]+"</option>";
		}
		aggFunctionsHtml += "</select>";
		
		var choserContentOrder = "<select name='chooseOrderByFunctions' onchange='setChosenAttributesOrderBy("+index+", "+j+", this.value); showRows();'>";
		for(var i = 0; i < orderByFunctions.length; i++) {
			choserContentOrder += "<option value='"+orderByFunctions[i]+"'>"+orderByFunctions[i]+"</option>";
		}
		choserContentOrder += "</select>";
		
		var histogramChooser = "";
		if(cardinalityLow) {
			histogramChooser = "<div onclick='prepareHistogram(&quot;"+tablename+"&quot;, &quot;"+field+"&quot;);' class='histogramIcon'>&nbsp;</div>";
		}
		
		content += "<tr>"+choserContent+"<td>"+field+""+histogramChooser+"</td><td>"+type+"</td><td>"+null_+"</td><td>"+key+"</td><td>"+default_+"</td><td>"+extra+"</td><td>"+unit+"</td><td>"+svg+"</br> "+cardinalityInfo+"</td><td>"+aggFunctionsHtml+"</td><td>"+choserContentOrder+"</td></tr>";
	}
	
	content += "</table></p>";

	document.getElementById("attributeInfo").innerHTML = content;
}

function showRows() {
	if(chosenTables.length != 0) {
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
									order += pathAliases[i]+"."+attributes[p].firstChild.textContent+" "+chosenAttributesOrderBy[index][p]+", ";
									orderVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" <span class='queryControlWords'>"+chosenAttributesOrderBy[index][p]+"</span>, ";
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
												order += pathAliases[i]+"."+attributes[p].firstChild.textContent+" "+chosenAttributesOrderBy[index][p]+", ";
												orderVisual += pathAliases[i]+"."+attributes[p].firstChild.textContent+" <span class='queryControlWords'>"+chosenAttributesOrderBy[index][p]+"</span>, ";
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
		}
		
		var limit = document.getElementById('limit').value;
		
		var query = "SELECT "+attributesQuery+" FROM "+tablesQuery+" "+joins+" "+order+" LIMIT "+limit;
		var queryVisual = "<span class='queryControlWords'>SELECT</span> "+attributesQuery+" <span class='queryControlWords'>FROM</span> "+tablesQueryVisual+" "+joinsVisual+" "+orderVisual+" <span class='queryControlWords'>LIMIT</span> "+limit;
		
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
									tableHeader += "<th>"+resultHeader[i].name;
									
									for(var j = 0; j < tables.length; j++) {
										var tablename = tables[j].firstChild.textContent;
										if(tablename == resultHeader[i].orgtable) {
											var attributes = tables[j].children[2].children;
											for(var l = 0; l < attributes.length; l++) {
												var attributeName = attributes[l].firstChild.textContent;
												if(attributeName == resultHeader[i].orgname) {
													var cardinalityLow = false;
													var key = attributes[l].children[3].textContent;
													if(attributeCardinalities[j][l] <= 50 && key != "PRI") {
														cardinalityLow = true;
													}
													if(cardinalityLow) {
														tableHeader += " <div onclick='prepareHistogram(&quot;"+tablename+"&quot;, &quot;"+attributeName+"&quot;);' class='histogramIcon'>&nbsp;</div>";
													}
												}
											}
										}
									}
									
									tableHeader += "</th>";
								}
											
								var rows = "";
								for(var i = 0; i < resultRows.length; i++) {
									rows += "<tr>";
									for(var j = 0; j < resultRows[i].length; j++) {
										rows += "<td>"+resultRows[i][j]+"</td>";
									}
									rows += "</tr>";
								}
											
								var content = "<p><table><tr>"+tableHeader+"</tr>"+rows+"</table></p>";
								document.getElementById("rowsTable").innerHTML = content;
							}
						},
						error: function (request, status, error) {
							console.log(error);
						}
					});
				}
			},
			error: function (request, status, error) {
				console.log(error);
			}
		});
	} else {
		document.getElementById("query").innerHTML = "";
	}
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

function prepareHistogram(table, attribute) {
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
								
				var heightNewWindow = ($(document).height())-600;
				var widthNewWindow = ($(document).width())-600;
				
				var newWindow = window.open("", "Histogram", "height="+heightNewWindow+",width="+widthNewWindow);
				var newWindowRoot = d3.select(newWindow.document.body)
					.style("font-family", "Arial, Helvetica, sans-serif")
					.style("background-color", "#fcfcfc")
					.style("font-size", "15px");
				
				newWindowRoot.append("div").append("h2")
					.html("Table: "+table+", Attribute: "+attribute)
					.style("color", "#000066");
				
				var newWindowChart = newWindowRoot.append("div");
					
				drawHistogram(newWindowChart, attribute, resultRows);
			}
		}
	});
}

function drawHistogram(newWindowRoot, attribute, data) {
	var nr_bars = data.length;
	var width_calculated = 25 * nr_bars;
	
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
		.orient("left")
		.ticks(10);

	var svg = newWindowRoot.append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
			.attr("transform", 
				"translate(" + margin.left + "," + margin.top + ")");
		
	x.domain(data.map(function(d) { return d[0]; }));
	y.domain([0, d3.max(data, function(d) { return d[1]; })]);
	//y.domain([0, d3.sum(data, function(d) { return d[1]; })]);

	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis)
		.selectAll("text")
			.style("text-anchor", "end")
			.attr("dx", "-.8em")
			.attr("dy", ".35em")
			.style("font-size", "14px")  
			.attr("transform", "rotate(-90)" );

	svg.append("g")
		.attr("class", "y axis")
		.call(yAxis)
		.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 6)
			.attr("dy", "-80")
			.style("text-anchor", "end")
			.text("Occurences Of");

	svg.selectAll("bar")
		.data(data)
		.enter().append("rect")
			.style("fill", "steelblue")
			.attr("x", function(d) { return x(d[0]); })
			.attr("width", x.rangeBand())
			.attr("y", function(d) { return y(d[1]); })
			.attr("height", function(d) { return height - y(d[1]); });
		
	svg.selectAll("rect").append("title")
		.text(function(d) {
			var percent = d[1] / d3.sum(data, function(d) { return d[1]; }) * 100;
			return d[0]+": "+d[1]+" ("+formatNumber(percent) +"%)";
		});
}

function formatNumber(number) {
	return number.toLocaleString('de-DE');
}

jQuery.fn.d3Click = function () {
  this.each(function (i, e) {
    var evt = new MouseEvent("click");
    e.dispatchEvent(evt);
  });
};