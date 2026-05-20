const request = require("supertest");
const { expect } = require("chai");

const getId = (item) => item?.result?.["@id"];
const getTitle = (item) =>
  item?.result?.titleDisplay?.[0] || item?.result?.title?.[0] || "(no title)";

const testCases = [
  {
    name: "author exact match",
    nyql: {
      q: 'author = "Meillassoux, Quentin"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      contributor: "Meillassoux, Quentin",
    },
  },
];

describe("Discovery API - NYQL vs Advanced Search equivalence", function () {
  this.timeout(30000);

  testCases.forEach(({ name, nyql, advanced }) => {
    it(`should match results for ${name}`, async () => {
      const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
      const endpoint = "/discovery/resources";
      const nyqlUrl = `${baseUrl}${endpoint}?${new URLSearchParams(nyql).toString()}`;
      const advancedUrl = `${baseUrl}${endpoint}?${new URLSearchParams(advanced).toString()}`;

      console.log("NYQL URL:", nyqlUrl);
      console.log("Advanced URL:", advancedUrl);

      const nyqlRes = await request(baseUrl)
        .get(endpoint)
        .query(nyql)
        .timeout(30000)
        .expect(200);

      const advancedRes = await request(baseUrl)
        .get(endpoint)
        .query(advanced)
        .timeout(30000)
        .expect(200);

      expect(nyqlRes.body.itemListElement).to.be.an("array");
      expect(advancedRes.body.itemListElement).to.be.an("array");

      const nyqlIds = nyqlRes.body.itemListElement.map(getId).filter(Boolean);
      const advancedIds = advancedRes.body.itemListElement
        .map(getId)
        .filter(Boolean);

      const nyqlOnly = nyqlIds.filter((id) => !advancedIds.includes(id));
      const advancedOnly = advancedIds.filter((id) => !nyqlIds.includes(id));
      const overlap = nyqlIds.filter((id) => advancedIds.includes(id));

      const sortedNyqlIds = [...nyqlIds].sort();
      const sortedAdvancedIds = [...advancedIds].sort();

      expect(nyqlIds.length).to.equal(advancedIds.length);
      expect(nyqlOnly).to.deep.equal([]);
      expect(advancedOnly).to.deep.equal([]);
      expect(sortedNyqlIds).to.deep.equal(sortedAdvancedIds);
      expect(overlap.length).to.equal(nyqlIds.length);

      console.log("NYQL count:", nyqlIds.length);
      console.log("Advanced count:", advancedIds.length);
      console.log("Overlap count:", overlap.length);
      console.log("NYQL-only sample IDs:", nyqlOnly.slice(0, 5));
      console.log("Advanced-only sample IDs:", advancedOnly.slice(0, 5));

      console.log("NYQL top titles:");
      nyqlRes.body.itemListElement.slice(0, 6).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${getTitle(item)} - ${getId(item)}`);
      });

      console.log("Advanced top titles:");
      advancedRes.body.itemListElement.slice(0, 6).forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${getTitle(item)} - ${getId(item)}`);
      });
    });
  });
});
