<!--
Author: Fiona Waser
-->

<html>
	<head>
		<meta charset="utf-8">
		<link rel="stylesheet" type="text/css" href="dbvisualizer.css">
		<title>Setup</title>
		<link rel="shortcut icon" href="img/favicon.ico" type="image/x-icon">
		<link rel="icon" href="img/favicon.ico" type="image/x-icon">
	</head>
	<body>
		<h1>Database Visualizer</h1>
	
		<?php
		include "functions_dbvisualizer.php";
		
		if($_SERVER['REQUEST_METHOD'] == 'POST') {
			$db_user = $_POST['db_user'];
			$db_pw = $_POST['db_pw'];
			$db_name = $_POST['db_name'];
			$db_host = $_POST['db_host'];
			
			$fileImportSuccess = true;
			
			if(!empty($_FILES['importFile']['name'])) {
				$importFile = $_FILES['importFile'];
				
				if(!fileImport($importFile)) {
					$fileImportSuccess = false;
					
					echo "<h2>Error with your Import File</h2>";
					
					echo "<p>Something went wrong with the file import or your file is not valid.</p>";
				
					echo "<p>Back to <a href='setup.php'>Setup Assistant</a></p>";
					
					echo "<p>Back to <a href='index.php'>Welcome Page</a></p>";
				}
			}
			
			$config_file_content = "[database]\nuser = ".$db_user."\npassword = ".$db_pw."\ndb_name = ".$db_name."\nhost = ".$db_host;
			
			if(file_exists("config.ini")) {
				unlink("config.ini");
			}
			
			$fp = fopen("config.ini", "w");
			fwrite($fp, $config_file_content);
			fclose($fp);
			
			if(@checkDBInfos($db_user, $db_pw, $db_name, $db_host)) {
				$con = mysqli_connect($db_host, $db_user, $db_pw);
				mysqli_select_db($con, $db_name);
				
				if(empty($_FILES['importFile']['name'])) {
					getMetadata($con, $db_name);
				}
				
				mysqli_close($con);
				
				if($fileImportSuccess) {
					echo "<h2>Setup successfull</h2>";
					
					echo "<p>Download the structure file <a href='download_structure_file.php'>here</a>.<br/>
					You can import this file to speed up the setup process next time providing the structure of the database is the same from the time the structure file was downloaded.<br/>
					You can always update row related information at the Visualization page.</p>";
					
					echo "<p>Back to <a href='setup.php'>Setup Assistant</a></p>";
					
					echo "<p>Back to <a href='index.php'>Welcome Page</a></p>";
				}
			} else {
				echo "<h2>Error with your Database Information</h2>";
				
				echo "<p>Something is wrong with your Database Information. Please check them and try again.</p>";
				
				echo "<p>Back to <a href='setup.php'>Setup Assistant</a></p>";
				
				echo "<p>Back to <a href='index.php'>Welcome Page</a></p>";
			}
		} else {
			if(file_exists("config.ini")) {
				$conf_old = parse_ini_file("config.ini", true);
				
				$username_old = $conf_old['database']['user'];
				$password_old = $conf_old['database']['password'];
				$dbn_old = $conf_old['database']['db_name'];
				$host_old = $conf_old['database']['host'];
			} else {
				$username_old = "";
				$password_old = "";
				$dbn_old = "";
				$host_old = "";
			}
		?>
		<div id="setup">
			<p>Following information is needed to set up the features:</p>
			
			<form name="setup" action="setup.php" method="post" enctype="multipart/form-data">
				<p>Database info:<p>
				<table>
					<tr><td>User:</td><td><input name="db_user" type="text" value="<?php echo $username_old; ?>" required/></td></tr>
					<tr><td>Password:</td><td><input name="db_pw" type="text" value="<?php echo $password_old; ?>" required/></td></tr>
					<tr><td>Database Name:</td><td><input name="db_name" type="text" value="<?php echo $dbn_old; ?>" required/></td></tr>
					<tr><td>Host:</td><td><input name="db_host" type="text" value="<?php echo $host_old; ?>" required/></td></tr>
					<tr></tr>
					<tr><td>Import file (optional):</td><td><input type="file" name="importFile" id="importFile"></td></tr>
				</table>
				
				<p><input name="submit_info" type="submit" value="Ready"></p>
			</form>
			
			<p><b>Important: </b> The database user needs SELECT privileges on Information_Schema and the chosen database.</p>
			
			<p>Back to <a href='index.php'>Welcome Page</a></p>
			<?php
			}
			?>
		</div>
	</body>
</html>