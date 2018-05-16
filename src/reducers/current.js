export default function reducers(state, action) {
  switch (action.type) {
  case 'SET_CURRENT_SUCCESS':
    return {
      ...state,
      modal: null,  // Hide diff
      current: action.current <= state.photos.length && action.current >= 0 ? action.current : -1
    };

  default:
    return state;
  }
}
