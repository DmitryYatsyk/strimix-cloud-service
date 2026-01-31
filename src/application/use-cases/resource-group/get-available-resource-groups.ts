const getAvailableResourceGroups = async () => {
  // TODO: Implement this
  console.log('getAvailableResourceGroups')
  return {
    resource_groups: [
      {
        id: 1,
        name: 'Resource Group 1',
      },
    ],
  }
}

export { getAvailableResourceGroups }
