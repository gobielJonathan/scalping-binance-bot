/**
 * Basic test to verify testing infrastructure works
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

// Simple test component
const TestComponent = defineComponent({
  name: 'TestComponent',
  template: '<div data-testid="test">Hello Testing!</div>'
})

describe('Testing Infrastructure', () => {
  it('should mount components correctly', () => {
    const wrapper = mount(TestComponent)
    
    expect(wrapper.find('[data-testid="test"]').text()).toBe('Hello Testing!')
    expect(wrapper.find('[data-testid="test"]').exists()).toBe(true)
  })
  
  it('should support async tests', async () => {
    const wrapper = mount(TestComponent)
    
    await wrapper.vm.$nextTick()
    
    expect(wrapper.isVisible()).toBe(true)
  })
  
  it('should support DOM queries', () => {
    const wrapper = mount(TestComponent)
    
    const element = wrapper.find('[data-testid="test"]')
    expect(element.element.tagName).toBe('DIV')
    expect(element.text()).toBe('Hello Testing!')
  })
})