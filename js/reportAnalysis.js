(function () {
  const studio = (window.PBIPInsightStudio = window.PBIPInsightStudio || {});
  const reportAnalysis = (studio.reportAnalysis = {});

  function summarizeVisuals(visuals) {
    const counts = {};
    visuals.forEach((visual) => {
      const type = visual.type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }

  reportAnalysis.analyze = function analyze(projectData) {
    const pages = Array.isArray(projectData?.report?.pages) ? projectData.report.pages : [];
    const visualList = pages.flatMap((page) => page.visuals || []);
    const counts = summarizeVisuals(visualList);

    return {
      pages,
      visualSummary: counts,
      totalVisuals: visualList.length,
      slicerCount: visualList.filter((visual) => /slicer/i.test(visual.type || '')).length,
      bookmarkCount: Array.isArray(projectData?.report?.bookmarks) ? projectData.report.bookmarks.length : 0,
      pageCount: pages.length,
      visiblePageCount: pages.filter((page) => !page.hidden).length,
      hiddenPageCount: pages.filter((page) => page.hidden).length,
    };
  };
})();
