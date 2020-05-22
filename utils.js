var generateHash = function(length = 9) {
	return Math.random().toString(18).slice(-length);
}
