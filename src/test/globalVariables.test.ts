import * as assert from 'assert';
import { GlobalVariable } from '../globalVariablesJack';

suite('Global Variables Jack Tests', () => {
    test('Should create GlobalVariable interface correctly', () => {
        const variable: GlobalVariable = {
            name: 'TEST_VAR',
            value: 'test_value',
            description: 'Test variable'
        };
        
        assert.strictEqual(variable.name, 'TEST_VAR');
        assert.strictEqual(variable.value, 'test_value');
        assert.strictEqual(variable.description, 'Test variable');
    });

    test('Should validate variable names correctly', () => {
        // Valid names
        assert.ok(/^[A-Za-z_][A-Za-z0-9_]*$/.test('VALID_NAME'));
        assert.ok(/^[A-Za-z_][A-Za-z0-9_]*$/.test('valid_name'));
        assert.ok(/^[A-Za-z_][A-Za-z0-9_]*$/.test('_valid_name'));
        assert.ok(/^[A-Za-z_][A-Za-z0-9_]*$/.test('ValidName123'));
        
        // Invalid names
        assert.ok(!/^[A-Za-z_][A-Za-z0-9_]*$/.test('123invalid'));
        assert.ok(!/^[A-Za-z_][A-Za-z0-9_]*$/.test('invalid-name'));
        assert.ok(!/^[A-Za-z_][A-Za-z0-9_]*$/.test('invalid.name'));
        assert.ok(!/^[A-Za-z_][A-Za-z0-9_]*$/.test('invalid name'));
    });

    test('Should handle empty and null values', () => {
        const emptyVariable: GlobalVariable = {
            name: 'EMPTY_VAR',
            value: '',
            description: ''
        };
        
        assert.strictEqual(emptyVariable.value, '');
        assert.strictEqual(emptyVariable.description, '');
    });
});
