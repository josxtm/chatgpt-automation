export function prSummaryRows(observations) {
  if (!Array.isArray(observations)) throw new TypeError('Expected PR observations');
  return observations.map(item => {
    if (!/^[\w.-]+\/[\w.-]+$/.test(item.repo) || !Number.isInteger(item.pr) || item.pr <= 0 || !/^[0-9a-f]{7,64}$/i.test(item.sha) || !['green','red','pending','unknown','draft'].includes(item.state)) {
      throw new Error('Invalid PR observation');
    }
    const url = 'https://github.com/' + item.repo + '/pull/' + item.pr;
    return '| [' + item.repo + '#' + item.pr + '](' + url + ') | `' + item.sha.slice(0, 7) + '` | **' + item.state.toUpperCase() + '** |';
  });
}
