const request = require("supertest");
const { expect } = require("chai");

const normalizeCallnumber = (value) =>
  String(value || "")
    .replace(/^[*"]+|[*"]+$/g, "")
    .trim()
    .toLowerCase();

const resultContainsCallnumber = (result, callnumber) => {
  const target = normalizeCallnumber(callnumber);
  const shelfMarks = [
    ...(Array.isArray(result?.shelfMark) ? result.shelfMark : []),
    ...(Array.isArray(result?.items)
      ? result.items.flatMap((item) =>
          Array.isArray(item?.shelfMark) ? item.shelfMark : [],
        )
      : []),
  ]
    .filter(Boolean)
    .map(normalizeCallnumber);

  // Check if any shelf mark contains the target as a substring or exact match
  return shelfMarks.some(
    (mark) => mark.includes(target) || target.includes(mark),
  );
};

const getId = (item) => item?.result?.["@id"];

// These are some tests to verify that certain NYQL queries are returning results with the expected precision, especially for fields like call numbers where we want to ensure that the query is matching the intended values and not over- or under-matching.

describe("Discovery API - NYQL precision tests", function () {
  this.timeout(30000);

  it('should return exactly one result for callnumber = "JFE 86-3252"', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";
    const callnumber = "JFE 86-3252";

    const res = await request(baseUrl)
      .get(endpoint)
      .query({
        q: `callnumber = "${callnumber}"`,
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    expect(res.body.itemListElement).to.be.an("array");

    // Assert exactly one result
    expect(res.body.itemListElement.length).to.equal(1);

    // Assert the result contains the target call number
    const result = res.body.itemListElement[0].result;
    expect(resultContainsCallnumber(result, callnumber)).to.be.true;

    // console.log("Result ID:", result["@id"]);
    // console.log("Result title:", result.titleDisplay?.[0] || result.title?.[0]);
  });

  it('all returned bibs should contain callnumber = "MGZMD"', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";
    const callnumber = "MGZMD";

    const res = await request(baseUrl)
      .get(endpoint)
      .query({
        q: `callnumber = "${callnumber}"`,
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    expect(res.body.itemListElement).to.be.an("array");

    // Assert at least one result
    expect(res.body.itemListElement.length).to.be.greaterThan(0);

    // Assert all results contain the target call number
    res.body.itemListElement.forEach((item, idx) => {
      const result = item.result;
      const shelfMarks = [
        ...(Array.isArray(result?.shelfMark) ? result.shelfMark : []),
        ...(Array.isArray(result?.items)
          ? result.items.flatMap((i) =>
              Array.isArray(i?.shelfMark) ? i.shelfMark : [],
            )
          : []),
      ].filter(Boolean);

      // console.log(`[${idx}] ID: ${result["@id"]}, Shelf marks:`, shelfMarks);

      expect(resultContainsCallnumber(result, callnumber)).to.be.true;
    });

    // console.log("Result ID:", res.body.itemListElement[0].result["@id"]);
    // console.log(
    //   "Result title:",
    //   res.body.itemListElement[0].result.titleDisplay?.[0] ||
    //     res.body.itemListElement[0].result.title?.[0],
    // );
  });

  it('should return exactly one result for identifier = "b10670401"', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";
    const identifier = "b10670401";

    const res = await request(baseUrl)
      .get(endpoint)
      .query({
        q: `identifier = "${identifier}"`,
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    expect(res.body.itemListElement).to.be.an("array");

    // Assert exactly one result
    expect(res.body.itemListElement.length).to.equal(1);

    // Assert the result contains the target identifier
    const result = res.body.itemListElement[0].result;
    expect(result["@id"]).to.equal(`res:${identifier}`);

    // console.log("Result ID:", result["@id"]);
    // console.log("Result title:", result.titleDisplay?.[0] || result.title?.[0]);
    // // log the url
    // console.log("Result URL:", result.url?.[0]);
  });

  it('should combine results for OR query: author = "Meillassoux, Quentin" OR title="the cat in the hat"', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const authorRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'author = "Meillassoux, Quentin"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const titleRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title = "the cat in the hat"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const combinedRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'author = "Meillassoux, Quentin" OR title="the cat in the hat"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const authorTotal = normalize(authorRes.body.totalResults) || 0;
    const titleTotal = normalize(titleRes.body.totalResults) || 0;
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0;

    // Check that the combined total equals the sum of the two individual searches
    expect(combinedTotal).to.equal(authorTotal + titleTotal);

    // Verify that the result sets themselves combined successfully up to the pagination limit
    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean);
    const titleIds = titleRes.body.itemListElement.map(getId).filter(Boolean);
    const combinedIds = combinedRes.body.itemListElement
      .map(getId)
      .filter(Boolean);

    const expectedIds = [...new Set([...authorIds, ...titleIds])].sort();
    const actualIds = [...combinedIds].sort();

    if (combinedTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds);
    }
  });

  it('should combine results for complex OR query: title="the cat in the hat" AND language="Yiddish" OR author = "Meillassoux, Quentin"', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const titleLangRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND language="Yiddish"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const authorRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'author = "Meillassoux, Quentin"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const combinedRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND language="Yiddish" OR author = "Meillassoux, Quentin"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const titleLangTotal = normalize(titleLangRes.body.totalResults) || 0;
    const authorTotal = normalize(authorRes.body.totalResults) || 0;
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0;

    expect(combinedTotal).to.equal(titleLangTotal + authorTotal);

    const titleLangIds = titleLangRes.body.itemListElement
      .map(getId)
      .filter(Boolean);
    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean);
    const combinedIds = combinedRes.body.itemListElement
      .map(getId)
      .filter(Boolean);

    const expectedIds = [...new Set([...titleLangIds, ...authorIds])].sort();
    const actualIds = [...combinedIds].sort();

    if (combinedTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds);
    }
  });

  it('should return results for NOT query: title="the cat in the hat" AND NOT language="Yiddish"', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const baseRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const excludedRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND language="Yiddish"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const combinedRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND NOT language="Yiddish"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const baseTotal = normalize(baseRes.body.totalResults) || 0;
    const excludedTotal = normalize(excludedRes.body.totalResults) || 0;
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0;

    expect(combinedTotal).to.equal(baseTotal - excludedTotal);

    const baseIds = baseRes.body.itemListElement.map(getId).filter(Boolean);
    const excludedIds = excludedRes.body.itemListElement
      .map(getId)
      .filter(Boolean);
    const combinedIds = combinedRes.body.itemListElement
      .map(getId)
      .filter(Boolean);

    const expectedIds = baseIds
      .filter((id) => !excludedIds.includes(id))
      .sort();
    const actualIds = [...combinedIds].sort();

    if (baseTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds);
    }
  });

  it('should return results for NOT query: title="the cat in the hat" NOT language="Yiddish"', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const baseRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const excludedRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND language="Yiddish"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const combinedRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" NOT language="Yiddish"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const baseTotal = normalize(baseRes.body.totalResults) || 0;
    const excludedTotal = normalize(excludedRes.body.totalResults) || 0;
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0;

    expect(combinedTotal).to.equal(baseTotal - excludedTotal);

    const baseIds = baseRes.body.itemListElement.map(getId).filter(Boolean);
    const excludedIds = excludedRes.body.itemListElement
      .map(getId)
      .filter(Boolean);
    const combinedIds = combinedRes.body.itemListElement
      .map(getId)
      .filter(Boolean);

    const expectedIds = baseIds
      .filter((id) => !excludedIds.includes(id))
      .sort();
    const actualIds = [...combinedIds].sort();

    if (baseTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds);
    }
  });

  it('should return results for NOT query: title="the cat in the hat" AND NOT language="yid" (same as "Yiddish")', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const yiddishRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND NOT language="Yiddish"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const yidRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND NOT language="yid"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const yiddishTotal = normalize(yiddishRes.body.totalResults) || 0;
    const yidTotal = normalize(yidRes.body.totalResults) || 0;

    expect(yidTotal).to.equal(yiddishTotal);

    const yiddishIds = yiddishRes.body.itemListElement
      .map(getId)
      .filter(Boolean);
    const yidIds = yidRes.body.itemListElement.map(getId).filter(Boolean);

    if (yiddishTotal <= 100) {
      expect([...yidIds].sort()).to.deep.equal([...yiddishIds].sort());
    }
  });

  it('should combine results for complex grouped query: title="the cat in the hat" AND (language="Yiddish" OR author="Meillassoux, Quentin")', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const titleLangRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND language="Yiddish"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const titleAuthorRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND author="Meillassoux, Quentin"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const combinedRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'title="the cat in the hat" AND (language="Yiddish" OR author="Meillassoux, Quentin")',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const titleLangTotal = normalize(titleLangRes.body.totalResults) || 0;
    const titleAuthorTotal = normalize(titleAuthorRes.body.totalResults) || 0;
    const combinedTotal = normalize(combinedRes.body.totalResults) || 0;

    expect(combinedTotal).to.equal(titleLangTotal + titleAuthorTotal);

    const titleLangIds = titleLangRes.body.itemListElement
      .map(getId)
      .filter(Boolean);
    const titleAuthorIds = titleAuthorRes.body.itemListElement
      .map(getId)
      .filter(Boolean);
    const combinedIds = combinedRes.body.itemListElement
      .map(getId)
      .filter(Boolean);

    const expectedIds = [
      ...new Set([...titleLangIds, ...titleAuthorIds]),
    ].sort();
    const actualIds = [...combinedIds].sort();

    if (combinedTotal <= 100) {
      expect(actualIds).to.deep.equal(expectedIds);
    }
  });

  it('should return exactly one result for keyword = "JFD 75-2521"', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";
    const keyword = "JFD 75-2521";

    const res = await request(baseUrl)
      .get(endpoint)
      .query({
        q: `keyword = "${keyword}"`,
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    expect(res.body.itemListElement).to.be.an("array");

    // Assert exactly one result
    expect(res.body.itemListElement.length).to.equal(1);

    const result = res.body.itemListElement[0].result;
    // console.log("Result ID:", result["@id"]);
    // console.log("Result title:", result.titleDisplay?.[0] || result.title?.[0]);
  });
  it('keyword any "pterosaur pterosaurs" matches "pterosaur" and "pterosaurs" results', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [pterosaurRes, pterosaursRes, anyRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'keyword = "pterosaur"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'keyword = "pterosaurs"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'keyword any "pterosaur pterosaurs"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const pterosaurTotal = normalize(pterosaurRes.body.totalResults) || 0;
    const pterosaursTotal = normalize(pterosaursRes.body.totalResults) || 0;
    const anyTotal = normalize(anyRes.body.totalResults) || 0;

    // "any" should return at least as many results as either individual search
    expect(anyTotal).to.be.at.least(pterosaurTotal);
    expect(anyTotal).to.be.at.least(pterosaursTotal);

    // All results from individual searches should appear in the "any" results
    const pterosaurIds = pterosaurRes.body.itemListElement
      .map(getId)
      .filter(Boolean);
    const pterosaursIds = pterosaursRes.body.itemListElement
      .map(getId)
      .filter(Boolean);
    const anyIds = anyRes.body.itemListElement.map(getId).filter(Boolean);

    pterosaurIds.forEach((id) => expect(anyIds).to.include(id));
    pterosaursIds.forEach((id) => expect(anyIds).to.include(id));

    // console.log("pterosaur total:", pterosaurTotal);
    // console.log("pterosaurs total:", pterosaursTotal);
    // console.log("any total:", anyTotal);
  });

  it('should return exactly one result for keyword = "33433076754203"', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";
    const keyword = "33433076754203";

    const res = await request(baseUrl)
      .get(endpoint)
      .query({
        q: `keyword = "${keyword}"`,
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);

    expect(res.body.itemListElement).to.be.an("array");

    // Assert exactly one result
    expect(res.body.itemListElement.length).to.equal(1);

    const result = res.body.itemListElement[0].result;
    // console.log("Result ID:", result["@id"]);
    // console.log("Result title:", result.titleDisplay?.[0] || result.title?.[0]);
  });

  it('keyword adj "jurassic pterosaur" matches only the pterosaur result with Jurassic in the title', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [pterosaurRes, adjRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'keyword = "pterosaur"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'keyword adj "jurassic pterosaur"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const adjIds = adjRes.body.itemListElement.map(getId).filter(Boolean);
    const pterosaurIds = pterosaurRes.body.itemListElement
      .map(getId)
      .filter(Boolean);

    // adj results must be a subset of pterosaur results
    adjIds.forEach((id) => expect(pterosaurIds).to.include(id));

    // all adj results should have "jurassic" in the title
    adjRes.body.itemListElement.forEach((item) => {
      const title = (
        item.result?.titleDisplay?.[0] ||
        item.result?.title?.[0] ||
        ""
      ).toLowerCase();
      expect(title).to.include("jurassic");
    });

    // pterosaur results that have "jurassic" in the title should all appear in adj results
    const pterosaurWithJurassicInTitle =
      pterosaurRes.body.itemListElement.filter((item) => {
        const title = (
          item.result?.titleDisplay?.[0] ||
          item.result?.title?.[0] ||
          ""
        ).toLowerCase();
        return title.includes("jurassic") && title.includes("pterosaur");
      });
    pterosaurWithJurassicInTitle.forEach((item) => {
      expect(adjIds).to.include(getId(item));
    });

    // console.log("pterosaur total:", pterosaurRes.body.totalResults);
    // console.log("adj total:", adjRes.body.totalResults);
    // console.log("adj IDs:", adjIds);
    // adjRes.body.itemListElement.forEach((item) => {
    //   console.log(
    //     " -",
    //     getId(item),
    //     item.result?.titleDisplay?.[0] || item.result?.title?.[0],
    //   );
    // });
  });

  it('keyword all "pterosaur pterosaurs" matches only results containing both keywords', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [pterosaurRes, pterosaursRes, allRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'keyword = "pterosaur"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'keyword = "pterosaurs"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'keyword all "pterosaur pterosaurs"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const pterosaurTotal = normalize(pterosaurRes.body.totalResults) || 0;
    const pterosaursTotal = normalize(pterosaursRes.body.totalResults) || 0;
    const allTotal = normalize(allRes.body.totalResults) || 0;

    // "all" (AND) should return no more results than either individual search
    expect(allTotal).to.be.at.most(pterosaurTotal);
    expect(allTotal).to.be.at.most(pterosaursTotal);

    // all "all" results must appear in both individual result sets (intersection)
    const pterosaurIds = new Set(
      pterosaurRes.body.itemListElement.map(getId).filter(Boolean),
    );
    const pterosaursIds = new Set(
      pterosaursRes.body.itemListElement.map(getId).filter(Boolean),
    );
    const allIds = allRes.body.itemListElement.map(getId).filter(Boolean);

    allIds.forEach((id) => {
      expect(pterosaurIds).to.include(id);
      expect(pterosaursIds).to.include(id);
    });

    // console.log("pterosaur total:", pterosaurTotal);
    // console.log("pterosaurs total:", pterosaursTotal);
    // console.log("all total:", allTotal);
  });

  it('author = "Meillassoux, Quentin" AND date >= "2011" matches only results with date >= 2011', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [authorRes, dateRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date >= "2011"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const authorTotal = normalize(authorRes.body.totalResults) || 0;
    const dateTotal = normalize(dateRes.body.totalResults) || 0;

    // date-filtered results must be a subset of author results
    expect(dateTotal).to.be.at.most(authorTotal);

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean);
    const dateIds = dateRes.body.itemListElement.map(getId).filter(Boolean);

    dateIds.forEach((id) => expect(authorIds).to.include(id));

    // all date-filtered results should have a date >= 2011 (when the field is present)
    dateRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      if (dateValues.length > 0) {
        const hasValidDate = dateValues.some((d) => parseInt(d, 10) >= 2011);
        expect(
          hasValidDate,
          `Expected date >= 2011 for ${getId(item)}, got: ${JSON.stringify(dateValues)}`,
        ).to.be.true;
      }
    });

    // author results with date < 2011 should NOT appear in date-filtered results
    const dateIdSet = new Set(dateIds);
    authorRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      const allBefore2011 =
        dateValues.length > 0 &&
        dateValues.every((d) => parseInt(d, 10) < 2011);
      if (allBefore2011) {
        expect(dateIdSet).not.to.include(getId(item));
      }
    });

    console.log("author total:", authorTotal);
    console.log("date >= 2011 total:", dateTotal);
    dateRes.body.itemListElement.forEach((item) => {
      console.log(
        " -",
        getId(item),
        item.result?.date,
        item.result?.titleDisplay?.[0] || item.result?.title?.[0],
      );
    });
  });
  it('author = "Meillassoux, Quentin" AND date > "2011" matches only results with date > 2011', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [authorRes, dateRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date > "2011"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const authorTotal = normalize(authorRes.body.totalResults) || 0;
    const dateTotal = normalize(dateRes.body.totalResults) || 0;

    // date-filtered results must be a subset of author results
    expect(dateTotal).to.be.at.most(authorTotal);

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean);
    const dateIds = dateRes.body.itemListElement.map(getId).filter(Boolean);

    dateIds.forEach((id) => expect(authorIds).to.include(id));

    // all date-filtered results should have a date > 2011 (when the field is present)
    dateRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      if (dateValues.length > 0) {
        const hasValidDate = dateValues.some((d) => parseInt(d, 10) > 2011);
        expect(
          hasValidDate,
          `Expected date > 2011 for ${getId(item)}, got: ${JSON.stringify(dateValues)}`,
        ).to.be.true;
      }
    });

    // author results with date <= 2011 should NOT appear in date-filtered results
    const dateIdSet = new Set(dateIds);
    authorRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      const allBeforeOrEqual2011 =
        dateValues.length > 0 &&
        dateValues.every((d) => parseInt(d, 10) <= 2011);
      if (allBeforeOrEqual2011) {
        expect(dateIdSet).not.to.include(getId(item));
      }
    });

    console.log("author total:", authorTotal);
    console.log("date > 2011 total:", dateTotal);
    dateRes.body.itemListElement.forEach((item) => {
      console.log(
        " -",
        getId(item),
        item.result?.date,
        item.result?.titleDisplay?.[0] || item.result?.title?.[0],
      );
    });
  });

  it('author = "Meillassoux, Quentin" AND date <= "2011" matches only results with date <= 2011', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [authorRes, dateRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date <= "2011"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const authorTotal = normalize(authorRes.body.totalResults) || 0;
    const dateTotal = normalize(dateRes.body.totalResults) || 0;

    // date-filtered results must be a subset of author results
    expect(dateTotal).to.be.at.most(authorTotal);

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean);
    const dateIds = dateRes.body.itemListElement.map(getId).filter(Boolean);

    dateIds.forEach((id) => expect(authorIds).to.include(id));

    // all date-filtered results should have a date <= 2011 (when the field is present)
    dateRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      if (dateValues.length > 0) {
        const hasValidDate = dateValues.some((d) => parseInt(d, 10) <= 2011);
        expect(
          hasValidDate,
          `Expected date <= 2011 for ${getId(item)}, got: ${JSON.stringify(dateValues)}`,
        ).to.be.true;
      }
    });

    // author results with all dates > 2011 should NOT appear in date-filtered results
    const dateIdSet = new Set(dateIds);
    authorRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      const allAfter2011 =
        dateValues.length > 0 &&
        dateValues.every((d) => parseInt(d, 10) > 2011);
      if (allAfter2011) {
        expect(dateIdSet).not.to.include(getId(item));
      }
    });

    // >= and <= "2011" together should cover all author results (when dates are present)
    const normalize2 = (t) => (typeof t === "object" ? t.value : t);
    const gteRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'author = "Meillassoux, Quentin" AND date >= "2011"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);
    const gteTotal = normalize2(gteRes.body.totalResults) || 0;
    expect(dateTotal + gteTotal).to.be.at.least(authorTotal);

    console.log("author total:", authorTotal);
    console.log("date <= 2011 total:", dateTotal);
    console.log("date >= 2011 total:", gteTotal);
    dateRes.body.itemListElement.forEach((item) => {
      console.log(
        " -",
        getId(item),
        item.result?.date,
        item.result?.titleDisplay?.[0] || item.result?.title?.[0],
      );
    });
  });

  it('author = "Meillassoux, Quentin" AND date < "2011" matches only results with date < 2011', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [authorRes, dateRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date < "2011"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const authorTotal = normalize(authorRes.body.totalResults) || 0;
    const dateTotal = normalize(dateRes.body.totalResults) || 0;

    // date-filtered results must be a subset of author results
    expect(dateTotal).to.be.at.most(authorTotal);

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean);
    const dateIds = dateRes.body.itemListElement.map(getId).filter(Boolean);

    dateIds.forEach((id) => expect(authorIds).to.include(id));

    // all date-filtered results should have a date < 2011 (when the field is present)
    dateRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      if (dateValues.length > 0) {
        const hasValidDate = dateValues.some((d) => parseInt(d, 10) < 2011);
        expect(
          hasValidDate,
          `Expected date < 2011 for ${getId(item)}, got: ${JSON.stringify(dateValues)}`,
        ).to.be.true;
      }
    });

    // author results with all dates >= 2011 should NOT appear in date-filtered results
    const dateIdSet = new Set(dateIds);
    authorRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      const allGte2011 =
        dateValues.length > 0 &&
        dateValues.every((d) => parseInt(d, 10) >= 2011);
      if (allGte2011) {
        expect(dateIdSet).not.to.include(getId(item));
      }
    });

    // < "2011" should return fewer results than <= "2011" (2011 itself is excluded)
    const lteRes = await request(baseUrl)
      .get(endpoint)
      .query({
        q: 'author = "Meillassoux, Quentin" AND date <= "2011"',
        search_scope: "cql",
        per_page: 100,
      })
      .timeout(30000)
      .expect(200);
    const lteTotal = normalize(lteRes.body.totalResults) || 0;
    expect(dateTotal).to.be.at.most(lteTotal);

    console.log("author total:", authorTotal);
    console.log("date < 2011 total:", dateTotal);
    console.log("date <= 2011 total:", lteTotal);
    dateRes.body.itemListElement.forEach((item) => {
      console.log(
        " -",
        getId(item),
        item.result?.date,
        item.result?.titleDisplay?.[0] || item.result?.title?.[0],
      );
    });
  });

  it('author = "Meillassoux, Quentin" AND date within "2011 2014" matches results in the time range', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [authorRes, withinRes, gteRes, lteRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date within "2011 2014"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date >= "2011"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date <= "2014"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const authorTotal = normalize(authorRes.body.totalResults) || 0;
    const withinTotal = normalize(withinRes.body.totalResults) || 0;
    const gteTotal = normalize(gteRes.body.totalResults) || 0;
    const lteTotal = normalize(lteRes.body.totalResults) || 0;

    // within results must be a subset of author results
    expect(withinTotal).to.be.at.most(authorTotal);

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean);
    const withinIds = withinRes.body.itemListElement.map(getId).filter(Boolean);

    withinIds.forEach((id) => expect(authorIds).to.include(id));

    // within results should be no more than either >= "2011" or <= "2014" alone
    expect(withinTotal).to.be.at.most(gteTotal);
    expect(withinTotal).to.be.at.most(lteTotal);

    // all within results should have a date in [2011, 2014] (when field is present)
    withinRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      if (dateValues.length > 0) {
        const hasValidDate = dateValues.some((d) => {
          const year = parseInt(d, 10);
          return year >= 2011 && year <= 2014;
        });
        expect(
          hasValidDate,
          `Expected date within 2011–2014 for ${getId(item)}, got: ${JSON.stringify(dateValues)}`,
        ).to.be.true;
      }
    });

    // author results with all dates outside [2011, 2014] should NOT appear in within results
    const withinIdSet = new Set(withinIds);
    authorRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      const allOutside =
        dateValues.length > 0 &&
        dateValues.every((d) => {
          const year = parseInt(d, 10);
          return year < 2011 || year > 2014;
        });
      if (allOutside) {
        expect(withinIdSet).not.to.include(getId(item));
      }
    });

    console.log("author total:", authorTotal);
    console.log("date within 2011-2014 total:", withinTotal);
    console.log("date >= 2011 total:", gteTotal);
    console.log("date <= 2014 total:", lteTotal);
    withinRes.body.itemListElement.forEach((item) => {
      console.log(
        " -",
        getId(item),
        item.result?.date,
        item.result?.titleDisplay?.[0] || item.result?.title?.[0],
      );
    });
  });

  it('title = "journal of paleontology" AND date > 2000 AND date encloses 1928 matches only results from date > 2000 that include 1928', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [baseRes, enclosesRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'title = "journal of paleontology" AND date > "2000"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'title = "journal of paleontology" AND date > "2000" AND date encloses "1928"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const baseTotal = normalize(baseRes.body.totalResults) || 0;
    const enclosesTotal = normalize(enclosesRes.body.totalResults) || 0;

    // encloses results must be a subset of the base (date > 2000) results
    expect(enclosesTotal).to.be.at.most(baseTotal);

    const baseIds = baseRes.body.itemListElement.map(getId).filter(Boolean);
    const enclosesIds = enclosesRes.body.itemListElement
      .map(getId)
      .filter(Boolean);

    enclosesIds.forEach((id) => expect(baseIds).to.include(id));

    // base results that do NOT enclose 1928 should not appear in encloses results
    // (detectable when dateRange start > 1928 or end < 1928 from the date field)
    const enclosesIdSet = new Set(enclosesIds);
    baseRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = (Array.isArray(dates) ? dates : [dates])
        .map((d) => parseInt(d, 10))
        .filter((d) => !isNaN(d));
      // If all date values are > 1928 (serial starting after 1928), it cannot enclose 1928
      if (dateValues.length > 0 && dateValues.every((d) => d > 1928)) {
        expect(enclosesIdSet).not.to.include(getId(item));
      }
    });

    console.log("date > 2000 total:", baseTotal);
    console.log("date > 2000 AND date encloses 1928 total:", enclosesTotal);
    enclosesRes.body.itemListElement.forEach((item) => {
      console.log(
        " -",
        getId(item),
        item.result?.date,
        item.result?.titleDisplay?.[0] || item.result?.title?.[0],
      );
    });
  });

  it('author = "Meillassoux, Quentin" AND date = "2015" matches only results with date 2015', async () => {
    const baseUrl = "https://qa-platform.nypl.org/api/v0.1";
    const endpoint = "/discovery/resources";

    const [authorRes, dateRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date = "2015"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const normalize = (t) => (typeof t === "object" ? t.value : t);
    const authorTotal = normalize(authorRes.body.totalResults) || 0;
    const dateTotal = normalize(dateRes.body.totalResults) || 0;

    // date-filtered results must be a subset of author results
    expect(dateTotal).to.be.at.most(authorTotal);

    const authorIds = authorRes.body.itemListElement.map(getId).filter(Boolean);
    const dateIds = dateRes.body.itemListElement.map(getId).filter(Boolean);

    dateIds.forEach((id) => expect(authorIds).to.include(id));

    // all date = "2015" results should have 2015 in their date field (when present)
    dateRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      if (dateValues.length > 0) {
        const has2015 = dateValues.some((d) => parseInt(d, 10) === 2015);
        expect(
          has2015,
          `Expected date = 2015 for ${getId(item)}, got: ${JSON.stringify(dateValues)}`,
        ).to.be.true;
      }
    });

    // author results with all dates !== 2015 should NOT appear in date = "2015" results
    const dateIdSet = new Set(dateIds);
    authorRes.body.itemListElement.forEach((item) => {
      const dates = item.result?.date || [];
      const dateValues = Array.isArray(dates) ? dates : [dates];
      const none2015 =
        dateValues.length > 0 &&
        dateValues.every((d) => parseInt(d, 10) !== 2015);
      if (none2015) {
        expect(dateIdSet).not.to.include(getId(item));
      }
    });

    // date = "2015" results should also appear in both >= "2015" and <= "2015"
    const [gteRes, lteRes] = await Promise.all([
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date >= "2015"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
      request(baseUrl)
        .get(endpoint)
        .query({
          q: 'author = "Meillassoux, Quentin" AND date <= "2015"',
          search_scope: "cql",
          per_page: 100,
        })
        .timeout(30000)
        .expect(200),
    ]);

    const gteIds = new Set(
      gteRes.body.itemListElement.map(getId).filter(Boolean),
    );
    const lteIds = new Set(
      lteRes.body.itemListElement.map(getId).filter(Boolean),
    );
    dateIds.forEach((id) => {
      expect(gteIds).to.include(id);
      expect(lteIds).to.include(id);
    });

    console.log("author total:", authorTotal);
    console.log("date = 2015 total:", dateTotal);
    dateRes.body.itemListElement.forEach((item) => {
      console.log(
        " -",
        getId(item),
        item.result?.date,
        item.result?.titleDisplay?.[0] || item.result?.title?.[0],
      );
    });
  });
});
