const makeBarChartData = (labels = [], datasetLabel = 'Revenue (BDT)', values = []) => {
  return {
    type: 'bar',
    labels,
    datasets: [
      {
        label: datasetLabel,
        data: values,
        backgroundColor: '#2563EB',
        borderRadius: 6,
      },
    ],
  };
};

const makePieChartData = ({ mistriTotal = 0, agentTotal = 0, platformTotal = 0 }) => {
  return {
    type: 'pie',
    labels: ['Mistri Share (80%)', 'Agent Share (5%)', 'Platform Share (15%/20%)'],
    datasets: [
      {
        data: [mistriTotal, agentTotal, platformTotal],
        backgroundColor: ['#10B981', '#F59E0B', '#3B82F6'],
      },
    ],
  };
};

module.exports = {
  makeBarChartData,
  makePieChartData,
};
