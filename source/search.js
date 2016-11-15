function searchAttributeAutocomplete(input) {
	var currentKeyword = input.split(" ");
	
	var e = document.getElementById('searchTable');
	var table = e.options[e.selectedIndex].value;
		
	var args = {"input": currentKeyword[currentKeyword.length-1], "table": table};
			
	jQuery.ajax({
		type: "POST",
		url: 'requests.php',
		dataType: 'json',
		data: {functionname: 'getAttributesAutocomplete', argument: args},

		success: function (obj, textstatus) {
			if(!('error' in obj) ) {
				result = obj.result;

				var content = "<datalist id='attributeSuggestions>";
				
				for(var i = 0; i < result.length; i++) {
					content += "<option value='"+result[i][0]+"'>";
				}
				
				content += "</datalist>";
				
				var dataList = document.getElementById('attributeSuggestions');
				dataList.innerHTML = content;
			}
		}
	});
}