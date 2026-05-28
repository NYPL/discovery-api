const request = require("supertest");
const { expect } = require("chai");
const { format } = require("winston");

const getId = (item) => item?.result?.["@id"];
const getTitle = (item) =>
  item?.result?.titleDisplay?.[0] || item?.result?.title?.[0] || "(no title)";
// These are some test cases where we want to compare NYQL results to advanced search results to verify that they match.  In some cases we may only want to compare totalResults counts rather than exact IDs, since some queries may be more precise in one interface vs the other.
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
  {
    name: 'keyword = "pterosaur"',
    nyql: {
      q: 'keyword = "pterosaur"',
      search_scope: "cql",
    },
    advanced: {
      q: "pterosaur",
    },
  },
  {
    name: "keyword = pterosaur",
    nyql: {
      q: "keyword = pterosaur",
      search_scope: "cql",
    },
    advanced: {
      q: "pterosaur",
    },
  },
  // this next test commented out for now.  it's buggy.  more investigation needed to determine if it's a NYQL issue or an advanced search issue. 5/27/26
  // {
  //   name: "cat in the hat title search",
  //   nyql: {
  //     q: 'title = "the cat in the hat"',
  //     search_scope: "cql",
  //   },
  //   advanced: {
  //     q: "",
  //     title: '"the cat in the hat"',
  //   },
  // },
  {
    name: "call number search",
    nyql: {
      q: 'callnumber = "^JFE 24"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      callnumber: "JFE 24",
    },
  },
  {
    name: "subject search",
    nyql: {
      q: 'subject = "Mitanni (Ancient kingdom)"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      subject: "Mitanni (Ancient kingdom)",
    },
  },
  {
    name: "Schwarzman location search",
    nyql: {
      q: 'center = "Schwarzman"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      filters: {
        buildingLocation: ["ma"],
      },
    },
  },
  {
    name: "SASB location search",
    nyql: {
      q: 'center = "SASB"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      filters: {
        buildingLocation: ["ma"],
      },
    },
  },
  {
    name: 'division = "Manuscript"',
    nyql: {
      q: 'division = "Manuscript"',
      search_scope: "cql",
      sort: "title",
      sort_direction: "asc",
    },
    advanced: {
      q: "",
      division: '"Manuscript"',
      filters: {
        collection: ["mao", "scd"],
      },
      sort: "title",
      sort_direction: "asc",
    },
  },
  {
    name: 'language = "Irish"',
    nyql: {
      q: 'language = "Irish"',
      search_scope: "cql",
      sort: "title",
      sort_direction: "asc",
    },
    advanced: {
      q: "",
      filters: {
        language: ["lang:gle", "lang:mga", "lang:sga"],
      },
      sort: "title",
      sort_direction: "asc",
    },
    compareTotalResultsOnly: true,
  },
  {
    name: 'genre = "memorial books"',
    nyql: {
      q: 'genre = "memorial books"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      genre: '"memorial books"',
    },
    advancedEndpoint: "/discovery/resources/aggregations",
    compareTotalResultsOnly: true,
  },
  {
    name: 'format = "tablet"',
    nyql: {
      q: 'format = "tablet"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      filters: {
        format: ["4"], // formatId for "tablet"
      },
    },
  },
  {
    name: 'title="the cat in the hat" AND language="Yiddish"',
    nyql: {
      q: 'title = "the cat in the hat" AND language = "Yiddish"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      title: '"the cat in the hat"',
      filters: {
        language: ["lang:yid"],
      },
    },
    compareTotalResultsOnly: true,
  },
  {
    name: 'title = "the cat in the hat" + apply "Yiddish" filter',
    nyql: {
      q: 'title = "the cat in the hat" AND language = "Yiddish"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      title: '"the cat in the hat"',
      filters: {
        language: ["lang:yid"],
      },
    },
  },
  {
    name: 'author = "Poe, Edgar Allan", page 2, sort A - Z',
    nyql: {
      q: 'author = "Poe, Edgar Allan"',
      search_scope: "cql",
      page: 2,
      sort: "title",
      sort_direction: "asc",
    },
    advanced: {
      q: "",
      contributor: '"Poe, Edgar Allan"',
      page: 2,
      sort: "title",
      sort_direction: "asc",
    },
  },
  {
    name: 'author all "Isaac Asimov"',
    nyql: {
      q: 'author = "Isaac Asimov"',
      search_scope: "cql",
    },
    advanced: {
      q: "",
      contributor: "Isaac Asimov",
    },
    advancedEndpoint: "/discovery/resources/aggregations",
  },
];

describe("Discovery API - NYQL vs Advanced Search equivalence", function () {
  this.timeout(30000);

  testCases.forEach(
    ({ name, nyql, advanced, advancedEndpoint, compareTotalResultsOnly }) => {
      it(`should match results for ${name}`, async () => {
        const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
        const endpoint = "/discovery/resources";
        const advEndpoint = advancedEndpoint || endpoint;
        const nyqlUrl = `${baseUrl}${endpoint}?${new URLSearchParams(nyql).toString()}`;
        const advancedUrl = `${baseUrl}${advEndpoint}?${new URLSearchParams(advanced).toString()}`;

        // console.log("NYQL URL:", nyqlUrl);
        // console.log("Advanced URL:", advancedUrl);

        const nyqlRes = await request(baseUrl)
          .get(endpoint)
          .query({ ...nyql, per_page: 100 })
          .timeout(30000)
          .expect(200);

        const advancedRes = await request(baseUrl)
          .get(advEndpoint)
          .query({ ...advanced, per_page: 100 })
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

        if (compareTotalResultsOnly) {
          const nyqlTotal = nyqlRes.body.totalResults;
          const advTotal = advancedRes.body.totalResults;
          // aggregations endpoint returns totalResults as { value, relation }
          const normalize = (t) => (typeof t === "object" ? t.value : t);
          expect(normalize(nyqlTotal)).to.equal(normalize(advTotal));
        } else {
          expect(nyqlIds.length).to.equal(advancedIds.length); // same number of results
          expect(nyqlOnly).to.deep.equal([]); // no NYQL-exclusive results
          expect(advancedOnly).to.deep.equal([]); // no advanced-exclusive results
          expect(sortedNyqlIds).to.deep.equal(sortedAdvancedIds); // same exact IDs
          expect(overlap.length).to.equal(nyqlIds.length); // all results overlap
        }

        // console.log("NYQL count:", nyqlIds.length);
        // console.log("Advanced count:", advancedIds.length);
        // console.log("Overlap count:", overlap.length);
        // console.log("NYQL-only sample IDs:", nyqlOnly.slice(0, 5));
        // console.log("Advanced-only sample IDs:", advancedOnly.slice(0, 5));
        console.log("NYQL URL:", nyqlUrl);
      });
    },
  );
});
