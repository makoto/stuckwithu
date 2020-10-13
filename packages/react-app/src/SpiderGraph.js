import Chart from 'chart.js'
import styled from '@emotion/styled/macro'
import React, { useEffect, useState } from 'react'
const d3 = require('d3')
const GraphContainer = styled('div')`
  background-color: white;
  color: #d8d8d8;
  padding: 1em;
  #myChart {
    cursor: pointer;
  }
`

const Legend = styled('div')`
  display: flex;
  justify-content: space-between;
  span {
    margin: 1em;
  }
`

const Canvas = styled('canvas')`
`
// background-color: #e9eef6;

const Title = styled('span')`
  font-weight: bold;
  font-size: large;
`

export default function SpiderGraph({labels, body}) {
  var colorLabels = d3.scaleOrdinal(d3.schemeCategory10).domain(body.map(b => b.name))
  var color = Chart.helpers.color;
  const chartRef = React.createRef()
  const [chart, setChart] = useState(false)
  
  var randomScalingFactor = function() {
    return Math.round(Math.random() * 100);
  };

  const createDataset = (_body, _color) => {
    // var colorNames = Object.keys(window.chartColors);
    // var colorName = colorNames[coinlength % colorNames.length];
    // var newColor = window.chartColors[colorName];
    var newColor = _color
    var newDataset = {
      label: _body.name || _body.address,
      borderColor: newColor,
      backgroundColor: color(newColor).alpha(0.2).rgbString(),
      pointBackgroundColor: newColor,
      data: [],
    };
  
    for (var index = 0; index < _body.tokenBalances.length; ++index) {
      newDataset.data.push(_body.tokenBalances[index]);
    }
    return newDataset
  }
  const datasets = body.map((b) => {
    return createDataset(b, colorLabels(b.name || b.address))
  })
  var config = {
      type: 'radar',
      data: {
          labels: labels,
          datasets
      },
      options: {
        animation: {
          duration: 0
        },
        legend: {
          position: 'top',
        },
        scale: {
          ticks: {
            beginAtZero: true
          }
        }
      }
  };
  useEffect(() => {
    const ctx = chartRef.current.getContext('2d')
    let _chart = new Chart(ctx, config)
    setChart(_chart)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (chart) {
    const datasets = chart.data.datasets
    const coinLength = datasets && datasets[0] && datasets[0].data.length
    // Come up with better way to skip re-renderring too many times.
    if(true){
      for (var index = 0; index < body.length; ++index) {
        var b = body[index]
        datasets[index] = createDataset(b, colorLabels(b.name))
      }
    }
    if (labels.length > coinLength) {
      chart.data.labels.push(labels[labels.length - 1]);
      datasets.forEach(function(dataset) {
        dataset.data.push(randomScalingFactor());
      });
    }
    chart.update()
  }

  return (
    <GraphContainer>
      <Canvas width="400px" height="400px" id="myChart" ref={chartRef} />
    </GraphContainer>
  )
}
