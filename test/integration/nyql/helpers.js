// this file to contain constants and helper functions for the integration tests

const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
const getId = (item) => item?.result?.["@id"];

module.exports = {
	baseUrl,
	getId,
};