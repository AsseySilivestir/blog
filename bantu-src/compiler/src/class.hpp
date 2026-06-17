#pragma once
/**
 * Bantu Language - Class System
 * Supports: single inheritance (extends), multiple inheritance (implements)
 */

#include "types.hpp"
#include "environment.hpp"
#include <unordered_map>
#include <string>
#include <vector>

class ClassDefinition {
public:
    std::string name;
    std::unordered_map<std::string, Value> methods;
    std::unordered_map<std::string, Value> staticMethods;
    ClassDefinition* parentClass = nullptr;                    // extends (single)
    std::vector<ClassDefinition*> implementsClasses;           // implements (multiple)

    ClassDefinition(const std::string& n) : name(n) {}

    void addMethod(const std::string& methodName, const Value& method) {
        methods[methodName] = method;
    }

    void addStaticMethod(const std::string& methodName, const Value& method) {
        staticMethods[methodName] = method;
    }

    // Look up method: own methods -> parent chain -> implements chain
    Value getMethod(const std::string& methodName) {
        // 1. Check own methods
        auto it = methods.find(methodName);
        if (it != methods.end()) return it->second;

        // 2. Check extends (parent) — single inheritance chain
        if (parentClass) {
            Value parentMethod = parentClass->getMethod(methodName);
            if (!parentMethod.isNull()) return parentMethod;
        }

        // 3. Check implements — multiple inheritance (depth-first, left-to-right)
        for (auto* impl : implementsClasses) {
            Value implMethod = impl->getMethod(methodName);
            if (!implMethod.isNull()) return implMethod;
        }

        return Value();
    }

    // Check if this class is or extends a given class (for isinstance)
    bool isInstanceOf(const std::string& className) {
        if (name == className) return true;
        if (parentClass && parentClass->isInstanceOf(className)) return true;
        for (auto* impl : implementsClasses) {
            if (impl->isInstanceOf(className)) return true;
        }
        return false;
    }
};

class ClassInstance {
public:
    ClassDefinition* classDef;
    std::unordered_map<std::string, Value> properties;

    ClassInstance(ClassDefinition* cd) : classDef(cd) {}

    Value getProperty(const std::string& propName) {
        // 1. Check instance properties (set at runtime)
        auto it = properties.find(propName);
        if (it != properties.end()) return it->second;

        // 2. Check class methods
        Value method = classDef->getMethod(propName);
        if (!method.isNull()) return method;

        return Value();
    }

    void setProperty(const std::string& propName, const Value& val) {
        properties[propName] = val;
    }
};
