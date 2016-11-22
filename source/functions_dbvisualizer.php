<?php
/*
Author: Fiona Waser

All PHP Functions of the application.
*/

/*
Checks if the given db-info is right by trying to establish a connection and selecting the db.

Parameters:
$db_user = database user name
$db_pw = database user password
$db_name = database name
$db_host = database host name

Returns true if a connections was established successfully and the database could be set.
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

/*
Imports the given structure file. In this process, the file is validated against the xsd schema file.

Parameters:
$file = file to import

Returns true if the file was successfully imported and the structure of the xml file was according to the xsd schema file in "/schemas/tables.xsd".
*/
function fileImport($file) {
	$currentPath = getcwd();
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
			
			$doc = new DOMDocument();
			$doc->load($currentPath."/".$target_file);

			$is_valid_xml = $doc->schemaValidate($currentPath."/schemas/tables.xsd");
			if($is_valid_xml) {
				return true;
			} else {
				return false;
			}
		} else {
			return false;
		}
	}
}

/*
Retrieves all the needed information for the visualization and writes the information into an xml file.
The xml file is counstructed according to the xsd schema file in "/schemas/tables.xsd".

Parameters:
$con = mysqli connection object
$db_name = database name

*/
function getMetadata($con, $db_name) {
	if(file_exists("tables.xml")) {
		unlink("tables.xml");
	}
			
	$tables = new SimpleXMLElement("<tables></tables>");
	$tables = getTables($con, $tables);
	$tables = getTableCounts($con, $tables);
	$tables = getAttributes($con, $tables);
	$tables = getConstraints($con, $tables, $db_name);
	$tables = findBridgeTables($tables);
	$tables->asXml("tables.xml");
}

/*
Gets all the tables and writes them to a SimpleXMLElement Object.

Parameters:
$con = mysqli connection object
$tables = the tables as SimpleXMLElement Object

Returns a SimpleXMLElement Object.
*/
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

/*
Retrieves number of rows for the given tables.

Parameters:
$con = mysqli connection object
$tables = the tables as SimpleXMLElement Object

Returns a SimpleXMLElement Object.
*/
function getTableCounts($con, $tables) {
	$newTables = $tables;
	
	$i = 0;
	foreach($tables->table as $table) {
		$query = "SELECT COUNT(*) FROM ".$table->name;
		$res = mysqli_query($con, $query);
		
		$newTables->table[$i]->nr_rows = mysqli_fetch_row($res)[0];
		
		$i++;
	}
	mysqli_free_result($res);
	
	return $newTables;
}

/*
Retrieves all attributes for the given tables.

Parameters:
$con = mysqli connection object
$tables = the tables as SimpleXMLElement Object

Returns a SimpleXMLElement Object.
*/
function getAttributes($con, $tables) {
	$newTables = $tables;
	
	$i = 0;
	foreach($tables->table as $table) {
		$nr_pri = 0;
		
		$query = "SHOW COLUMNS FROM ".$table->name;
		$res = mysqli_query($con, $query);
		
		$attributes = $newTables->table[$i]->addChild("attributes", "");
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
		
		$i++;
	}
	mysqli_free_result($res);
	
	return $newTables;
}

/*
Returns all the contraints of the tables as SimpleXMLElement Object.
Tries to get all constraints, meaning Primary and Foreign. If only Primary key constraints are available, the function "getContraintsAutomatically" gets them automatically.

Parameters:
$con = mysqli connection object
$tables = the tables as SimpleXMLElement Object
$dbname = database name

Returns a SimpleXMLElement Object.
*/
function getConstraints($con, $tables, $dbname) {
	$newTables = $tables;
	
	$query = "SELECT * FROM information_schema.table_constraints WHERE constraint_schema = '".$dbname."' and constraint_type != 'PRIMARY KEY' and constraint_type != 'UNIQUE KEY'";
	$res = mysqli_query($con, $query);
				
	if(mysqli_num_rows($res)) {
		$i = 0;
		foreach($tables->table as $table) {
			$query = "SELECT COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_COLUMN_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME = '".$table->name."' AND TABLE_SCHEMA = '".$dbname."' AND CONSTRAINT_NAME != 'UNIQUE'";
			$res = mysqli_query($con, $query);
						
			$constraints = $newTables->table[$i]->addChild("constraints", "");
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
					
			$constraints = $newTables->table[$i]->addChild("constraints", "");
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
		
		$newTables = getContraintsAutomatically($con, $newTables);
	}
	mysqli_free_result($res);
	
	return $newTables;
}

/*
Reads Foreignkey connections and return the SimpleXMLElement Object.
Two attributes are connected if they have the right name, meaning related to pk table, and suffixes pk/id or fk. Also they have to have the same mysql datatype.

Parameters:
$con = mysqli connection object
$tables = the tables as SimpleXMLElement Object

Returns a SimpleXMLElement Object.
*/
function getContraintsAutomatically($con, $tables) {
	$newTables = $tables;
	
	foreach($tables->table as $table) {
		foreach($table->constraints->constraint as $constraint) {
			$pk_attribute = $constraint->column_name;
			$pk_attribute_type = "";
			foreach($table->attributes->attribute as $pk_attribute_info) {
				if(strcmp($pk_attribute_info->field, $pk_attribute) == 0) {
					$pk_attribute_type = $pk_attribute_info->type;
				}
			}
			
			$i = 0;
			foreach($tables->table as $tableSearch) {
				foreach($tableSearch->attributes->attribute as $attributeSearch) {
					if($table->name != $tableSearch->name) {
						$search_attribute = $attributeSearch->field;
						$search_attribute_type = $attributeSearch->type;
						
						if(
						(
						(($pk_attribute == $table->name || ((substr($pk_attribute, 0, -2) == $table->name) && (endsWithIgnoreCase($pk_attribute, "id") || endsWithIgnoreCase($pk_attribute, "pk")))) && $search_attribute == $table->name) ||
						(($pk_attribute == $table->name || ((substr($pk_attribute, 0, -2) == $table->name) && (endsWithIgnoreCase($pk_attribute, "id") || endsWithIgnoreCase($pk_attribute, "pk")))) && (substr($search_attribute, 0, -2) == $table->name) && endsWithIgnoreCase($search_attribute, "fk"))
						)
						&& 
						(strcmp($pk_attribute_type, $search_attribute_type) == 0)
						) {
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

/*
Adds an attribute to every bridge table to dentify the bridge table.

Parameters:
$tables = the tables as SimpleXMLElement Object

Returns a SimpleXMLElement Object.
*/
function findBridgeTables($tables) {
	$newTables = $tables;
	
	$i = 0;
	foreach($tables->table as $table) {
		$nrAttributes = count($tables->table[$i]->attributes->attribute);
		$nrConstraints = count($tables->table[$i]->constraints->constraint);
		
		if($nrAttributes <= $nrConstraints) {
			$newTables->table[$i]->addAttribute("bridgeTable", true);
		}
		
		$i++;
	}
	
	return $newTables;
}

/*
Retrieves row related infos from the metadate and directly writes them to the structure file "tables.xml".
Row related infos are the number of rows and the number of different values for attributes and constraints.

Parameters:
$con = mysqli connection object
$tables = the tables as SimpleXMLElement Object
$dbname = database name
*/
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

/*
Returns an array attributes from the chosen table for autocomplete purposes.

Parameters:
$input = input from user
$table = the tables the user searches in
*/
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

/*
Performs the given query with databse info retrieved from the config file "config.ini" and returns an array of result rows.

Parameters:
$query = query to perform
*/
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

/*
Performs the given query with databse info retrieved from the config file "config.ini" and returns an array of header information for this particular query.

Parameters:
$query = query to perform
*/
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

/*
Checks if the given string represents a mysql number type.

Parameters:
$type = the type string to check

Return true if it is a number, else false.
*/
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

/*
Checks if the given string starts wiht the other string.
The cases of the strings are being ignored.

Parameters:
$haystack = the string to search in
$needle = the string to search for

Returns true if the string starts with the other string, else false;
*/
function startsWithIgnoreCase($haystack, $needle) {
    $length = strlen($needle);
	
	$haystack = strtolower($haystack);
	$needle = strtolower($needle);
	
    return (substr($haystack, 0, $length) === $needle);
}

/*
Checks if the given string ends wiht the other string.
The cases of the strings are being ignored.

Parameters:
$haystack = the string to search in
$needle = the string to search for

Returns true if the string ends with the other string, else false;
*/
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