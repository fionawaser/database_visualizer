<?php
/*
Author: Fiona Waser
*/

function checkDBInfos($db_user, $db_pw, $db_name, $db_host) {
	$con = mysqli_connect($db_host, $db_user, $db_pw);
	
	if(!$con) {
		return false;
	} else {
		$db_select = mysqli_select_db($con, $db_name);
		
		if(!$db_select) {
			return false;
		}
		
		mysqli_close($con);
	}
	
	return true;
}

function fileImport($file) {
	echo print_r($file);
	$target_file = "tables.xml";
	$uploadOk = 1;
	$fileType = $file["type"];
	
	if($fileType != "text/xml") {
		$uploadOk = 0;
	}
	
	if ($uploadOk == 0) {
		return false;
	} else {
		if (move_uploaded_file($file["tmp_name"], $target_file)) {
			return true;
		} else {
			return false;
		}
	}
}

function getMetadata($con, $db_name) {
	if(file_exists("tables.xml")) {
		unlink("tables.xml");
	}
			
	$tables = new SimpleXMLElement("<tables></tables>");
	$tables = getTables($con, $tables);
	$tables = getTableCounts($con, $tables);
	$tables = getAttributes($con, $tables);
	$tables = getConstraints($con, $tables, $db_name);
	$tables->asXml("tables.xml");
}

function getTables($con, $tables) {
	$query = "SHOW FULL TABLES";
	$res = mysqli_query($con, $query);
	
	if(mysqli_num_rows($res)) {
		while($row = mysqli_fetch_row($res)) {
			$table = $tables->addChild("table", "");
			
			$table->addChild("name", $row[0]);
		}
	}
	mysqli_free_result($res);
	
	return $tables;
}

function getTableCounts($con, $tables) {
	$new_tables = $tables;
	
	$i = 0;
	foreach($tables->table as $table) {
		$query = "SELECT COUNT(*) FROM ".$table->name;
		$res = mysqli_query($con, $query);
		
		$new_tables->table[$i]->nr_rows = mysqli_fetch_row($res)[0];
		
		$i++;
	}
	mysqli_free_result($res);
	
	return $new_tables;
}

function getAttributes($con, $tables) {
	$new_tables = $tables;
	
	$i = 0;
	foreach($tables->table as $table) {
		$nr_pri = 0;
		
		$query = "SHOW COLUMNS FROM ".$table->name;
		$res = mysqli_query($con, $query);
		
		$attributes = $new_tables->table[$i]->addChild("attributes", "");
		if(mysqli_num_rows($res)) {
			while($row = mysqli_fetch_array($res, MYSQLI_ASSOC)) {
				$attribute = $attributes->addChild("attribute", "");
				
				$attribute->addChild("field", $row["Field"]);
				$attribute->addChild("type", $row["Type"]);
				$attribute->addChild("null_", $row["Null"]);
				$attribute->addChild("key", $row["Key"]);
				$attribute->addChild("default", $row["Default"]);
				$attribute->addChild("extra", $row["Extra"]);
				
				$queryC = "SELECT COUNT(DISTINCT(".$row["Field"].")) FROM ".$table->name;
				$resC = mysqli_query($con, $queryC);
				$nr_diff_values = mysqli_fetch_row($resC)[0];
				$attribute->addChild("nr_diff_values", $nr_diff_values);
				
				if($row["Key"] == "PRI") {
					$nr_pri++;
				}
				
				if(isSqlTypNumber($row["Type"])) {
					if(stripos($row["Field"], "price") !== FALSE || stripos($row["Field"], "cost") !== FALSE) {
						$attribute->addAttribute("unit", "money");
					} else if(stripos($row["Field"], "length") !== FALSE) {
						$attribute->addAttribute("unit", "length");
					} else if(stripos($row["Field"], "mass") !== FALSE) {
						$attribute->addAttribute("unit", "mass");
					} else if((stripos($row["Field"], "time")) !== FALSE || (stripos($row["Field"], "duration"))) {
						$attribute->addAttribute("unit", "time");
					}
				}
			}
		}
		if($attributes->attribute->count() == $nr_pri) {
			$new_tables->table[$i]->addAttribute("isJoinTable", true);
		}
		
		$i++;
	}
	mysqli_free_result($res);
	
	return $new_tables;
}

function getConstraints($con, $tables, $dbname) {
	$new_tables = $tables;
	
	$query = "SELECT * FROM information_schema.table_constraints WHERE constraint_schema = '".$dbname."' and constraint_type != 'PRIMARY KEY'";
	$res = mysqli_query($con, $query);
				
	if(mysqli_num_rows($res)) {
		$i = 0;
		foreach($tables->table as $table) {
			$query = "SELECT COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_COLUMN_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME = '".$table->name."' AND TABLE_SCHEMA = '".$dbname."'";
			$res = mysqli_query($con, $query);
						
			$constraints = $new_tables->table[$i]->addChild("constraints", "");
			if(mysqli_num_rows($res)) {
				while($row = mysqli_fetch_array($res, MYSQLI_ASSOC)) {
					$constraint = $constraints->addChild("constraint", "");
					
					$constraint->addChild("column_name", $row["COLUMN_NAME"]);
					$constraint->addChild("constraint_name", $row["CONSTRAINT_NAME"]);
					$constraint->addChild("referenced_column_name", $row["REFERENCED_COLUMN_NAME"]);
					$constraint->addChild("referenced_table_name", $row["REFERENCED_TABLE_NAME"]);
					
					$queryC = "SELECT COUNT(DISTINCT(".$row["COLUMN_NAME"].")) FROM ".$table->name;
					$resC = mysqli_query($con, $queryC);
					$nr_diff_column_values = mysqli_fetch_row($resC)[0];
					$constraint->addChild("nr_diff_column_values", $nr_diff_column_values);
				}
			}
			$i++;
		}
	} else {
		$i = 0;
		foreach($tables->table as $table) {
			$query = "SHOW KEYS FROM ".$table->name." WHERE Key_name = 'PRIMARY'";
			$res = mysqli_query($con, $query);
					
			$constraints = $new_tables->table[$i]->addChild("constraints", "");
			if(mysqli_num_rows($res)) {
				while($row = mysqli_fetch_array($res, MYSQLI_ASSOC)) {
					$constraint = $constraints->addChild("constraint", "");
					
					$constraint->addChild("column_name", $row["Column_name"]);
					$constraint->addChild("constraint_name", "PRIMARY");
					$constraint->addChild("referenced_column_name", null);
					$constraint->addChild("referenced_table_name", null);
					$constraint->addChild("nr_diff_column_values", null);
				}
			}
			$i++;
		}
		
		$new_tables = getContraintsAutomatically($con, $new_tables);
	}
	mysqli_free_result($res);
	
	return $new_tables;
}

function getContraintsAutomatically($con, $tables) {
	$newTables = $tables;
	
	foreach($tables->table as $table) {
		foreach($table->constraints->constraint as $constraint) {
			$pk_attribute = $constraint->column_name;
			
			$i = 0;
			foreach($tables->table as $tableSearch) {
				foreach($tableSearch->attributes->attribute as $attributeSearch) {
					if($table->name != $tableSearch->name) {
						$search_attribute = $attributeSearch->field;
						
						if((substr($pk_attribute, 0, -2) == substr($search_attribute, 0, -2)) && endsWithIgnoreCase($pk_attribute, "ID") && endsWithIgnoreCase($search_attribute, "FK")) {
							$constraint = $newTables->table[$i]->constraints->addChild("constraint", "");
								
							$constraint->addChild("column_name", $search_attribute);
							$constraint->addChild("constraint_name", "FOREIGNauto");
							$constraint->addChild("referenced_column_name", $pk_attribute);
							$constraint->addChild("referenced_table_name", $table->name);
							
							$queryC = "SELECT COUNT(DISTINCT(".$search_attribute.")) FROM ".$tableSearch->name;
							$resC = mysqli_query($con, $queryC);
							$nr_diff_column_values = mysqli_fetch_row($resC)[0];
							$constraint->addChild("nr_diff_column_values", $nr_diff_column_values);
							
							mysqli_free_result($resC);
						}
					}
				}
				$i++;
			}
		}
	}
	
	return $newTables;
}

function refreshRowRelatedInfo($con, $tables, $dbname) {
	$newTables = $tables;
	
	foreach($tables->table as $table) {
		$query = "SELECT COUNT(*) FROM ".$table->name;
		$res = mysqli_query($con, $query);
		
		$table->nr_rows = mysqli_fetch_row($res)[0];
		
		foreach($table->attributes->attribute as $attribute) {
			$field = $attribute->field;
			
			$queryC = "SELECT COUNT(DISTINCT(".$field.")) FROM ".$table->name;
			$resC = mysqli_query($con, $queryC);
			$nr_diff_values = mysqli_fetch_row($resC)[0];
			$attribute->nr_diff_values = $nr_diff_values;
		}
		
		foreach($table->constraints->constraint as $constraint) {
			$column_name = $constraint->column_name;
			
			$queryC = "SELECT COUNT(DISTINCT(".$column_name.")) FROM ".$table->name;
			$resC = mysqli_query($con, $queryC);
			$nr_diff_column_values = mysqli_fetch_row($resC)[0];
			$constraint->addChild("nr_diff_column_values", $nr_diff_column_values);
		}
	}
	mysqli_free_result($res);
	
	$newTables->asXml("tables.xml");
}

function addPieChart($con, $chartname, $table1Name, $table2Name, $displayAttributeTable2) {
	if(file_exists("statistics.xml")) {
		$statistics = simplexml_load_file("statistics.xml");
		$pieCharts = $statistics->pieCharts;
		
		unlink("statistics.xml");
	} else {
		$statistics = new SimpleXMLElement("<statistics></statistics>");
		$pieCharts = $statistics->addChild("pieCharts", "");
	}
	
	$pieChart = $pieCharts->addChild("pieChart", "");
	$pieChart->addChild("chartname", $chartname);
	$pieChart->addChild("table1Name", $table1Name);
	$pieChart->addChild("table2Name", $table2Name);
	$pieChart->addChild("displayAttributeTable2", $displayAttributeTable2);
	
	$tables = simplexml_load_file("tables.xml");
	
	foreach($tables->table as $table) {
		if($table->name == $table1Name) {
			$table1 = $table;
		}
		
		if($table->name == $table2Name) {
			$table2 = $table;
		}
	}
	
	$sourceFile = calculatePieChartData($con, $table1, $table2, $displayAttributeTable2);
	$pieChart->addChild("sourceFile", $sourceFile);
	
	$statistics->asXml("statistics.xml");
}

function calculatePieChartData($con, $table1, $table2, $displayAttributeTable2) {
	$pkTable2 = "";
	foreach($table2->attributes->attribute as $attribute) {
		if($attribute->key == "PRI") {
			$pkTable2 = $attribute->field;
		}
	}
	
	$fkTable1 = "";
	foreach($table1->constraints->constraint as $constraint) {
		if(strcmp($constraint->referenced_table_name, $table2->name) == 0 && strcmp($constraint->referenced_column_name, $pkTable2) == 0) {
			$fkTable1 = $constraint->column_name;
		}
	}
	
	$allReferenceValues = array();
	$query = "SELECT ".$pkTable2.", ".$displayAttributeTable2." FROM ".$table2->name;
	$res = mysqli_query($con, $query);
	if(mysqli_num_rows($res)) {
		while($row = mysqli_fetch_array($res, MYSQLI_ASSOC)) {
			array_push($allReferenceValues, $row);
		}
	}
	mysqli_free_result($res);
	
	$data = array();
	foreach($allReferenceValues as $listItem) {
		$query = "SELECT COUNT(*) FROM ".$table1->name." JOIN ".$table2->name." ON ".$table2->name.".".$pkTable2." = ".$table1->name.".".$fkTable1." WHERE ".$table2->name.".".$displayAttributeTable2." = '".$listItem[$displayAttributeTable2]."'";
		$res = mysqli_query($con, $query);
		$nr = mysqli_fetch_row($res)[0];
		
		$element = array();
		$element["refTable2"] = $listItem[$displayAttributeTable2];
		$element["nr"] = $nr;
		
		array_push($data, $element);
	}
	mysqli_free_result($res);
	
	$counter = 0;
	foreach(glob('statistics/*.*') as $file) {
		$filename = explode("_",$file);
		if($filename[0] == "statistics/pieChart") {
			$counter++;
		}
	}
	$fileNr = $counter++;
	
	$header = "col,count";
	$filepath = "statistics/pieChart_".$fileNr.".csv";
	$file = fopen($filepath, "w");
	fputcsv($file,explode(',',$header));
	foreach($data as $dataRow) {
		$content = $dataRow["refTable2"].",".$dataRow["nr"];
		fputcsv($file,explode(',',$content));
	}
	fclose($file);
	
	return $filepath;
}

function getAttributesAutocomplete($input, $table) {
	$settings = parse_ini_file("config.ini", true);
		
	$username = $settings['database']['user'];
	$password = $settings['database']['password'];
	$dbn = $settings['database']['db_name'];
	$host = $settings['database']['host'];

	$con = mysqli_connect($host, $username, $password);

	mysqli_select_db($con, $dbn);
	
	$query = "SHOW columns FROM ".$table." WHERE field LIKE '".$input."%'";
	
	$rows = array();
	$res = mysqli_query($con, $query);
	if(mysqli_num_rows($res)) {
		while($row = mysqli_fetch_row($res)) {
			array_push($rows, $row);
		}
	}
	mysqli_free_result($res);
	
	return $rows;
}

function processQueryRequest($query) {
	$settings = parse_ini_file("config.ini", true);
		
	$username = $settings['database']['user'];
	$password = $settings['database']['password'];
	$dbn = $settings['database']['db_name'];
	$host = $settings['database']['host'];

	$con = mysqli_connect($host, $username, $password);

	mysqli_select_db($con, $dbn);
	
	$rows = array();
	$res = mysqli_query($con, $query);
	if(mysqli_num_rows($res)) {
		while($row = mysqli_fetch_row($res)) {
			array_push($rows, $row);
		}
	}
	mysqli_free_result($res);
	
	return $rows;
}

function processQueryHeaderRequest($query) {
	$settings = parse_ini_file("config.ini", true);
		
	$username = $settings['database']['user'];
	$password = $settings['database']['password'];
	$dbn = $settings['database']['db_name'];
	$host = $settings['database']['host'];

	$con = mysqli_connect($host, $username, $password);

	mysqli_select_db($con, $dbn);
	
	$rows = array();
	$res = mysqli_query($con, $query);
	$finfo = mysqli_fetch_fields($res);
	foreach ($finfo as $val) {
		$element["name"] = $val->name;
		$element["orgname"] = $val->orgname;
		$element["table"] = $val->table;
		$element["orgtable"] = $val->orgtable;
		
		array_push($rows, $element);
	}
	mysqli_free_result($res);
	
	return $rows;
}


function isSqlTypNumber($type) {
	$list = array();
	array_push($list, "int");
	array_push($list, "dec");
	array_push($list, "numeric");
	array_push($list, "fixed");
	array_push($list, "float");
	array_push($list, "double");
	array_push($list, "bit");
	array_push($list, "real");
	
	foreach ($list as $item) {
		if (stripos($type, $item) !== FALSE) {
			return true;
		}
	}
	
	return false;
}

function startsWithIgnoreCase($haystack, $needle) {
    $length = strlen($needle);
	
	$haystack = strtolower($haystack);
	$needle = strtolower($needle);
	
    return (substr($haystack, 0, $length) === $needle);
}

function endsWithIgnoreCase($haystack, $needle) {
    $length = strlen($needle);
    if ($length == 0) {
        return true;
    }

	$haystack = strtolower($haystack);
	$needle = strtolower($needle);
	
    return (substr($haystack, -$length) === $needle);
}
?>