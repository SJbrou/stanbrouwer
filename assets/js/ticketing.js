(function() {
  var DAY_MS = 24 * 60 * 60 * 1000;

  function parseTimePart(value) {
    var match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    if (!match) {
      return null;
    }

    return {
      hours: parseInt(match[1], 10),
      minutes: parseInt(match[2], 10)
    };
  }

  function getDateParts(dateIso) {
    var match = String(dateIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }

    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10) - 1,
      day: parseInt(match[3], 10)
    };
  }

  function getTimeRange(event) {
    var matches = String(event && event.time || '').match(/\d{1,2}:\d{2}/g) || [];
    var start = parseTimePart(matches[0]);
    var end = parseTimePart(event && event.end_time) || parseTimePart(matches[1]);

    return {
      start: start,
      end: end
    };
  }

  function getEventEndDate(event) {
    var dateParts = getDateParts(event && event.date_iso);
    var timeRange = getTimeRange(event || {});
    var endTime = timeRange.end || { hours: 23, minutes: 59 };
    var endDate;

    if (!dateParts) {
      return null;
    }

    endDate = new Date(dateParts.year, dateParts.month, dateParts.day, endTime.hours, endTime.minutes, 0, 0);

    if (timeRange.start && (endTime.hours < timeRange.start.hours || (endTime.hours === timeRange.start.hours && endTime.minutes <= timeRange.start.minutes))) {
      endDate.setDate(endDate.getDate() + 1);
    }

    return endDate;
  }

  function getTicketCutoffDate(event) {
    var endDate = getEventEndDate(event);

    if (!endDate) {
      return null;
    }

    return new Date(endDate.getTime() + DAY_MS);
  }

  function isTicketingOpen(event, now) {
    var cutoffDate = getTicketCutoffDate(event);

    if (!cutoffDate) {
      return true;
    }

    return (now || new Date()).getTime() <= cutoffDate.getTime();
  }

  window.TZTicketing = {
    getEventEndDate: getEventEndDate,
    getTicketCutoffDate: getTicketCutoffDate,
    isTicketingOpen: isTicketingOpen
  };
})();